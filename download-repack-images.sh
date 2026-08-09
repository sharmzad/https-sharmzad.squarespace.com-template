#!/bin/bash
# Download the 6 Repack Travel images used on diving.html and rewrite
# the URLs so diving.html points at local files instead of hotlinks.
# Run this ONCE from a machine with normal internet (your PC or Bluehost).

set -e
cd "$(dirname "$0")"
mkdir -p images/repack

BASE="https://repacktravelmktg.com/wp-content/uploads/2024/05"

echo "Downloading 6 Repack Travel images to images/repack/..."
for f in \
    "Sharm-El-Sheikh-Trips-pack-9-600x600.jpg" \
    "Main-Home-2-600x600.jpeg" \
    "DSC09760-600x600.jpg" \
    "51204456163_dd3fd31de1_b-600x600.jpg" \
    "51204440253_f01cb7b087_b-600x600.jpg" \
    "Marsa-Alam-diving-packages-1.jpg"
do
    if [[ -f "images/repack/$f" ]]; then
        echo "  skip (exists): $f"
    else
        echo "  fetch: $f"
        curl -sSLo "images/repack/$f" "$BASE/$f"
    fi
done

echo ""
echo "Rewriting URLs in diving.html to point at local files..."
sed -i.bak "s|https://repacktravelmktg.com/wp-content/uploads/2024/05/|images/repack/|g" diving.html
echo "  backup saved as diving.html.bak"

echo ""
echo "Done. Verify diving.html and commit:"
echo "  git add images/repack diving.html && git commit -m 'Self-host Repack images'"
