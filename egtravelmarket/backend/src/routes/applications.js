const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const requireExpert = (req, res, next) => {
  const userType = req.user.userType || req.user.user_type;
  
  if (!['guide', 'diver', 'mentor'].includes(userType)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only experts can apply to jobs'
    });
  }
  next();
};

router.post('/', verifyToken, requireExpert, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { jobId, coverMessage } = req.body;

    if (!jobId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Job ID is required'
      });
    }

    const jobResult = await client.query(
      `SELECT j.id, j.job_type, j.title, j.posted_by, j.approval_status, j.status, j.application_deadline
       FROM jobs j
       WHERE j.id = $1`,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Job not found'
      });
    }

    const job = jobResult.rows[0];

    if (job.approval_status !== 'approved' || job.status !== 'active') {
      return res.status(400).json({
        error: 'Invalid Request',
        message: 'This job is not available for applications'
      });
    }

    if (job.application_deadline) {
      const deadline = new Date(job.application_deadline);
      deadline.setHours(23, 59, 59, 999);
      const now = new Date();
      if (deadline < now) {
        return res.status(400).json({
          error: 'Application Deadline Expired',
          message: `The application deadline for this job was ${new Date(job.application_deadline).toLocaleDateString()}. The agency set a limited time to find the best candidate quickly.`
        });
      }
    }

    const userId = req.user.userId || req.user.id;
    const expertResult = await client.query(
      `SELECT id, expert_type FROM expert_profiles WHERE user_id = $1`,
      [userId]
    );

    if (expertResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Expert profile not found'
      });
    }

    const expert = expertResult.rows[0];

    if (expert.expert_type !== job.job_type) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `This job is for ${job.job_type}s only`
      });
    }

    const existingApplication = await client.query(
      'SELECT id FROM job_applications WHERE job_id = $1 AND expert_id = $2',
      [jobId, expert.id]
    );

    if (existingApplication.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already applied to this job'
      });
    }

    await client.query('BEGIN');

    const applicationResult = await client.query(
      `INSERT INTO job_applications (
        job_id, expert_id, user_id, cover_message, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'applied', NOW(), NOW())
      RETURNING *`,
      [jobId, expert.id, userId, coverMessage]
    );

    await client.query(
      'UPDATE jobs SET application_count = application_count + 1, updated_at = NOW() WHERE id = $1',
      [jobId]
    );

    await client.query('COMMIT');

    const application = applicationResult.rows[0];

    res.status(201).json({
      message: 'Application submitted successfully',
      application: {
        id: application.id,
        jobId: application.job_id,
        coverMessage: application.cover_message,
        status: application.status,
        createdAt: application.created_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Apply to job error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to submit application'
    });
  } finally {
    client.release();
  }
});

router.get('/job/:jobId', verifyToken, async (req, res) => {
  try {
    const { jobId } = req.params;

    const jobResult = await pool.query(
      'SELECT posted_by FROM jobs WHERE id = $1',
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Job not found'
      });
    }

    const job = jobResult.rows[0];

    const userType = req.user.userType || req.user.user_type;
    if (job.posted_by !== userId && userType !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view applications for your own jobs'
      });
    }

    const applicationsResult = await pool.query(
      `SELECT 
        ja.*,
        u.full_name, u.email, u.phone,
        ep.slug, ep.display_name, ep.expert_type, ep.bio, ep.location, ep.profile_photo,
        ep.experience_years, ep.languages, ep.specialties, ep.certifications,
        ep.whatsapp, ep.instagram, ep.facebook, ep.website
      FROM job_applications ja
      INNER JOIN users u ON ja.user_id = u.id
      INNER JOIN expert_profiles ep ON ja.expert_id = ep.id
      WHERE ja.job_id = $1
      ORDER BY ja.created_at DESC`,
      [jobId]
    );

    const applications = applicationsResult.rows.map(row => ({
      id: row.id,
      jobId: row.job_id,
      coverMessage: row.cover_message,
      status: row.status,
      viewedAt: row.viewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expert: {
        id: row.expert_id,
        userId: row.user_id,
        slug: row.slug,
        displayName: row.display_name,
        expertType: row.expert_type,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        bio: row.bio,
        location: row.location,
        profilePhoto: row.profile_photo,
        experienceYears: row.experience_years,
        languages: row.languages ? row.languages.split(',').map(l => l.trim()) : [],
        specialties: row.specialties ? row.specialties.split(',').map(s => s.trim()) : [],
        certifications: row.certifications ? row.certifications.split(',').map(c => c.trim()) : [],
        whatsapp: row.whatsapp,
        instagram: row.instagram,
        facebook: row.facebook,
        website: row.website
      }
    }));

    res.json({
      applications,
      total: applications.length
    });

  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve applications'
    });
  }
});

router.get('/my-applications', verifyToken, requireExpert, async (req, res) => {
  try {
    const expertResult = await pool.query(
      'SELECT id FROM expert_profiles WHERE user_id = $1',
      [req.user.userId]
    );

    if (expertResult.rows.length === 0) {
      return res.json({
        applications: [],
        total: 0,
        message: 'No expert profile found. Please complete your profile to apply for jobs.'
      });
    }

    const expertId = expertResult.rows[0].id;

    const applicationsResult = await pool.query(
      `SELECT 
        ja.*,
        j.title, j.job_type, j.location, j.employment_type, 
        j.salary_min, j.salary_max, j.currency, j.salary_period,
        j.status as job_status, j.approval_status as job_approval_status,
        j.posted_by,
        u.user_type as poster_type,
        COALESCE(ap.company_name, dc.center_name) as company_name,
        COALESCE(ap.slug, dc.slug) as company_slug,
        COALESCE(ap.logo_url, dc.logo_url) as logo_url,
        COALESCE(ap.location, dc.location) as company_location
      FROM job_applications ja
      INNER JOIN jobs j ON ja.job_id = j.id
      INNER JOIN users u ON j.posted_by = u.id
      LEFT JOIN agency_profiles ap ON j.posted_by = ap.user_id AND u.user_type = 'agency'
      LEFT JOIN dive_center_profiles dc ON j.posted_by = dc.user_id AND u.user_type = 'divecenter'
      WHERE ja.expert_id = $1
      ORDER BY ja.created_at DESC`,
      [expertId]
    );

    const applications = applicationsResult.rows.map(row => ({
      id: row.id,
      jobId: row.job_id,
      coverMessage: row.cover_message,
      status: row.status,
      viewedAt: row.viewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      job: {
        title: row.title,
        jobType: row.job_type,
        location: row.location,
        employmentType: row.employment_type,
        salaryMin: row.salary_min,
        salaryMax: row.salary_max,
        currency: row.currency,
        salaryPeriod: row.salary_period,
        status: row.job_status,
        approvalStatus: row.job_approval_status,
        posterType: row.poster_type,
        company: {
          name: row.company_name,
          slug: row.company_slug,
          logo: row.logo_url,
          location: row.company_location
        }
      }
    }));

    res.json({
      applications,
      total: applications.length
    });

  } catch (error) {
    console.error('Get my applications error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve your applications'
    });
  }
});

router.put('/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['applied', 'viewed', 'contacted', 'rejected', 'hired'].includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid status'
      });
    }

    const applicationResult = await pool.query(
      `SELECT ja.*, j.posted_by
       FROM job_applications ja
       INNER JOIN jobs j ON ja.job_id = j.id
       WHERE ja.id = $1`,
      [id]
    );

    if (applicationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Application not found'
      });
    }

    const application = applicationResult.rows[0];

    const userType = req.user.userType || req.user.user_type;
    if (application.posted_by !== req.user.userId && userType !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update applications for your own jobs'
      });
    }

    const updateFields = ['status = $1', 'updated_at = NOW()'];
    const params = [status];

    if (status === 'viewed' && !application.viewed_at) {
      updateFields.push('viewed_at = NOW()');
    }

    const result = await pool.query(
      `UPDATE job_applications SET ${updateFields.join(', ')}
       WHERE id = $2
       RETURNING *`,
      [...params, id]
    );

    const updatedApplication = result.rows[0];

    res.json({
      message: 'Application status updated',
      application: {
        id: updatedApplication.id,
        status: updatedApplication.status,
        viewedAt: updatedApplication.viewed_at,
        updatedAt: updatedApplication.updated_at
      }
    });

  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to update application status'
    });
  }
});

module.exports = router;
