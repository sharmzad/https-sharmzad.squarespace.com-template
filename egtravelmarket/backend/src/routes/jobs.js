const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { logAction } = require('../utils/logger');
const { sendAdminJobPostNotification } = require('../config/email');

const router = express.Router();

const requireAgencyOrDiveCenter = (req, res, next) => {
  const userType = req.user.userType || req.user.user_type;
  if (userType !== 'agency' && userType !== 'divecenter') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only agencies and dive centers can post jobs'
    });
  }
  next();
};

router.post('/', verifyToken, requireAgencyOrDiveCenter, async (req, res) => {
  try {
    const userType = req.user.userType || req.user.user_type;
    const userId = req.user.userId || req.user.id;
    const posterCheck = await pool.query(
      `SELECT approval_status FROM users WHERE id = $1`,
      [userId]
    );

    if (posterCheck.rows.length === 0 || posterCheck.rows[0].approval_status !== 'approved') {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Your ${userType === 'divecenter' ? 'dive center' : 'agency'} account must be approved before posting jobs`
      });
    }

    const {
      jobType,
      title,
      description,
      location,
      employmentType,
      salaryMin,
      salaryMax,
      currency,
      salaryPeriod,
      requirements,
      benefits,
      startDate,
      duration,
      contactWhatsapp,
      contactEmail,
      applicationDeadline
    } = req.body;

    if (!jobType || !title || !description || !location) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Job type, title, description, and location are required'
      });
    }

    if (!['guide', 'diver', 'mentor'].includes(jobType)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid job type. Must be guide, diver, or mentor'
      });
    }

    if (salaryMin && salaryMax && parseFloat(salaryMin) > parseFloat(salaryMax)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Minimum salary cannot be greater than maximum salary'
      });
    }

    if (!contactWhatsapp && !contactEmail) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'At least one contact method (WhatsApp or email) is required'
      });
    }

    const result = await pool.query(
      `INSERT INTO jobs (
        posted_by, poster_type, job_type, title, description, location,
        employment_type, salary_min, salary_max, currency, salary_period,
        requirements, benefits, start_date, duration,
        contact_whatsapp, contact_email, application_deadline,
        status, approval_status, view_count, application_count, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'active', 'pending', 0, 0, NOW(), NOW())
      RETURNING *`,
      [
        userId,
        userType,
        jobType,
        title,
        description,
        location,
        employmentType,
        salaryMin,
        salaryMax,
        currency || 'USD',
        salaryPeriod,
        requirements,
        benefits,
        startDate,
        duration,
        contactWhatsapp,
        contactEmail,
        applicationDeadline
      ]
    );

    const job = result.rows[0];

    // Get user/company info for logging and notification
    let posterInfo = {};
    if (userType === 'agency') {
      const agencyResult = await pool.query('SELECT company_name FROM agency_profiles WHERE user_id = $1', [userId]);
      posterInfo = agencyResult.rows[0] || {};
    } else if (userType === 'divecenter') {
      const dcResult = await pool.query('SELECT center_name FROM dive_center_profiles WHERE user_id = $1', [userId]);
      posterInfo = dcResult.rows[0] || {};
    }
    const userResult = await pool.query('SELECT email, full_name FROM users WHERE id = $1', [userId]);
    const userEmail = userResult.rows[0]?.email || 'unknown';
    posterInfo.full_name = userResult.rows[0]?.full_name;
    
    await logAction('job_post', userId, userEmail, userType, 'success', `Job posted: ${title}`, { jobId: job.id, jobType, title });

    // Send admin notification for new job post (non-blocking)
    sendAdminJobPostNotification(job, posterInfo).catch(err => {
      console.error('❌ Admin job post notification error:', err.message);
    });

    res.status(201).json({
      message: 'Job posted successfully. Pending admin approval.',
      job: {
        id: job.id,
        jobType: job.job_type,
        title: job.title,
        description: job.description,
        location: job.location,
        employmentType: job.employment_type,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        currency: job.currency,
        salaryPeriod: job.salary_period,
        approvalStatus: job.approval_status,
        status: job.status,
        createdAt: job.created_at
      }
    });

  } catch (error) {
    console.error('Create job error:', error);
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]).catch(() => ({ rows: [{ email: 'unknown' }] }));
    const userEmail = userResult.rows[0]?.email || 'unknown';
    await logAction('job_post', userId, userEmail, userType, 'error', error.message, {});
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to create job'
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { 
      jobType, 
      location, 
      minSalary, 
      maxSalary, 
      employmentType,
      search,
      limit = 50,
      offset = 0
    } = req.query;

    const maxLimit = Math.min(parseInt(limit) || 50, 100);
    const validOffset = Math.max(parseInt(offset) || 0, 0);

    let query = `
      SELECT 
        j.*,
        ap.company_name,
        ap.slug as agency_slug,
        ap.logo_url,
        ap.location as company_location,
        dcp.center_name,
        dcp.slug as divecenter_slug,
        dcp.logo_url as divecenter_logo,
        dcp.location as divecenter_location
      FROM jobs j
      LEFT JOIN agency_profiles ap ON j.posted_by = ap.user_id AND j.poster_type = 'agency'
      LEFT JOIN dive_center_profiles dcp ON j.posted_by = dcp.user_id AND j.poster_type = 'divecenter'
      WHERE 1=1
    `;
    console.log('📍 Fetching ALL jobs (no filter)');
    
    const params = [];
    let paramIndex = 1;

    if (jobType) {
      query += ` AND j.job_type = $${paramIndex}`;
      params.push(jobType);
      paramIndex++;
    }

    if (location) {
      query += ` AND j.location ILIKE $${paramIndex}`;
      params.push(`%${location}%`);
      paramIndex++;
    }

    if (minSalary) {
      query += ` AND j.salary_max >= $${paramIndex}`;
      params.push(parseFloat(minSalary));
      paramIndex++;
    }

    if (maxSalary) {
      query += ` AND j.salary_min <= $${paramIndex}`;
      params.push(parseFloat(maxSalary));
      paramIndex++;
    }

    if (employmentType) {
      query += ` AND j.employment_type = $${paramIndex}`;
      params.push(employmentType);
      paramIndex++;
    }

    if (search) {
      query += ` AND (j.title ILIKE $${paramIndex} OR j.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY j.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(maxLimit, validOffset);

    const result = await pool.query(query, params);

    const jobs = result.rows.map(row => {
      const companyName = row.poster_type === 'divecenter' ? row.center_name : row.company_name;
      const companySlug = row.poster_type === 'divecenter' ? row.divecenter_slug : row.agency_slug;
      const companyLogo = row.poster_type === 'divecenter' ? row.divecenter_logo : row.logo_url;
      const companyLocation = row.poster_type === 'divecenter' ? row.divecenter_location : row.company_location;
      
      return {
        id: row.id,
        jobType: row.job_type,
        expert_type: row.job_type,
        title: row.title,
        description: row.description,
        location: row.location,
        employmentType: row.employment_type,
        salaryMin: row.salary_min,
        salaryMax: row.salary_max,
        salary_min: row.salary_min,
        salary_max: row.salary_max,
        currency: row.currency,
        salaryPeriod: row.salary_period,
        requirements: row.requirements,
        benefits: row.benefits,
        startDate: row.start_date,
        duration: row.duration,
        contactWhatsapp: row.contact_whatsapp,
        contactEmail: row.contact_email,
        contact_whatsapp: row.contact_whatsapp,
        contact_email: row.contact_email,
        applicationDeadline: row.application_deadline,
        application_deadline: row.application_deadline,
        viewCount: row.view_count,
        applicationCount: row.application_count,
        createdAt: row.created_at,
        created_at: row.created_at,
        company: {
          name: companyName,
          slug: companySlug,
          logo: companyLogo,
          location: companyLocation,
          type: row.poster_type
        }
      };
    });

    res.json({
      jobs,
      total: jobs.length,
      limit: maxLimit,
      offset: validOffset
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve jobs'
    });
  }
});

router.get('/my-jobs', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const result = await pool.query(
      `SELECT 
        j.*,
        COUNT(ja.id) as total_applications
      FROM jobs j
      LEFT JOIN job_applications ja ON j.id = ja.job_id
      WHERE j.posted_by = $1
      GROUP BY j.id
      ORDER BY j.created_at DESC`,
      [userId]
    );

    const jobs = result.rows.map(row => ({
      id: row.id,
      jobType: row.job_type,
      title: row.title,
      description: row.description,
      location: row.location,
      employmentType: row.employment_type,
      salaryMin: row.salary_min,
      salaryMax: row.salary_max,
      currency: row.currency,
      salaryPeriod: row.salary_period,
      status: row.status,
      approvalStatus: row.approval_status,
      rejectionReason: row.rejection_reason,
      viewCount: row.view_count,
      applicationCount: row.application_count,
      totalApplications: parseInt(row.total_applications),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      jobs,
      total: jobs.length
    });

  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve your jobs'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      'UPDATE jobs SET view_count = view_count + 1 WHERE id = $1',
      [id]
    );

    const result = await pool.query(
      `SELECT 
        j.*,
        ap.company_name,
        ap.slug as agency_slug,
        ap.logo_url,
        ap.location as company_location,
        ap.website_url as company_website,
        dcp.center_name,
        dcp.slug as divecenter_slug,
        dcp.logo_url as divecenter_logo,
        dcp.location as divecenter_location,
        dcp.website_url as divecenter_website
      FROM jobs j
      LEFT JOIN agency_profiles ap ON j.posted_by = ap.user_id AND j.poster_type = 'agency'
      LEFT JOIN dive_center_profiles dcp ON j.posted_by = dcp.user_id AND j.poster_type = 'divecenter'
      WHERE j.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Job not found'
      });
    }

    const row = result.rows[0];
    const companyName = row.poster_type === 'divecenter' ? row.center_name : row.company_name;
    const companySlug = row.poster_type === 'divecenter' ? row.divecenter_slug : row.agency_slug;
    const companyLogo = row.poster_type === 'divecenter' ? row.divecenter_logo : row.logo_url;
    const companyLocation = row.poster_type === 'divecenter' ? row.divecenter_location : row.company_location;
    const companyWebsite = row.poster_type === 'divecenter' ? row.divecenter_website : row.company_website;
    
    const job = {
      id: row.id,
      jobType: row.job_type,
      expert_type: row.job_type,
      title: row.title,
      description: row.description,
      location: row.location,
      employmentType: row.employment_type,
      salaryMin: row.salary_min,
      salaryMax: row.salary_max,
      salary_min: row.salary_min,
      salary_max: row.salary_max,
      currency: row.currency,
      salaryPeriod: row.salary_period,
      requirements: row.requirements,
      benefits: row.benefits,
      startDate: row.start_date,
      duration: row.duration,
      contactWhatsapp: row.contact_whatsapp,
      contactEmail: row.contact_email,
      contact_whatsapp: row.contact_whatsapp,
      contact_email: row.contact_email,
      applicationDeadline: row.application_deadline,
      application_deadline: row.application_deadline,
      status: row.status,
      approvalStatus: row.approval_status,
      viewCount: row.view_count,
      views: row.view_count,
      applicationCount: row.application_count,
      createdAt: row.created_at,
      created_at: row.created_at,
      updatedAt: row.updated_at,
      company: {
        name: companyName,
        slug: companySlug,
        logo: companyLogo,
        location: companyLocation,
        website: companyWebsite,
        type: row.poster_type
      }
    };

    res.json(job);

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve job'
    });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;
    const {
      title,
      description,
      location,
      employmentType,
      salaryMin,
      salaryMax,
      salaryPeriod,
      requirements,
      benefits,
      startDate,
      duration,
      contactWhatsapp,
      contactEmail,
      applicationDeadline
    } = req.body;

    const checkResult = await pool.query(
      'SELECT posted_by FROM jobs WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Job not found'
      });
    }

    if (checkResult.rows[0].posted_by !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own jobs'
      });
    }

    const result = await pool.query(
      `UPDATE jobs SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        location = COALESCE($3, location),
        employment_type = COALESCE($4, employment_type),
        salary_min = COALESCE($5, salary_min),
        salary_max = COALESCE($6, salary_max),
        salary_period = COALESCE($7, salary_period),
        requirements = COALESCE($8, requirements),
        benefits = COALESCE($9, benefits),
        start_date = COALESCE($10, start_date),
        duration = COALESCE($11, duration),
        contact_whatsapp = COALESCE($12, contact_whatsapp),
        contact_email = COALESCE($13, contact_email),
        application_deadline = COALESCE($14, application_deadline),
        updated_at = NOW()
      WHERE id = $15
      RETURNING *`,
      [
        title, description, location, employmentType, salaryMin, salaryMax,
        salaryPeriod, requirements, benefits, startDate, duration,
        contactWhatsapp, contactEmail, applicationDeadline, id
      ]
    );

    const job = result.rows[0];

    res.json({
      message: 'Job updated successfully',
      job: {
        id: job.id,
        title: job.title,
        description: job.description,
        location: job.location,
        approvalStatus: job.approval_status,
        status: job.status,
        updatedAt: job.updated_at
      }
    });

  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to update job'
    });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const checkResult = await pool.query(
      'SELECT posted_by FROM jobs WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Job not found'
      });
    }

    if (checkResult.rows[0].posted_by !== req.user.userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own jobs'
      });
    }

    await pool.query(
      'UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2',
      ['closed', id]
    );

    res.json({
      message: 'Job closed successfully'
    });

  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to close job'
    });
  }
});

module.exports = router;
