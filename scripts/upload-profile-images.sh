#!/bin/bash

# Script to upload profile images and update employee records
# Images are matched to employees by name

BUCKET="profile-image"
PROJECT_REF="ogzyihacqbasolfxymgo"
BASE_URL="https://${PROJECT_REF}.supabase.co/storage/v1/object/public/${BUCKET}"
IMAGE_DIR="resource/profile-image"
TIMESTAMP=$(date +%s)000

# Employee mappings: filename (without .jpg) -> employee_id
declare -A EMPLOYEE_MAP

# Images with spaces in filenames
EMPLOYEE_MAP["สุทธิพร  พรหมเพศ"]="b1b81f9c-9048-45d6-a0db-2b3b80005314"
EMPLOYEE_MAP["รวี สวนสมุทร"]="86f42b8f-e992-47cb-be0f-8e81ebddcd09"
EMPLOYEE_MAP["วัชรินทร์ แซ่จิว"]="70142883-b78a-4589-8352-e27e69adbee5"
EMPLOYEE_MAP["วันเฉลิม จิบจันทร์"]="1da007c0-8513-4292-9d5b-6bde3e7c1600"
EMPLOYEE_MAP["วีรศักดิ์ ชมความสุข"]="8a2f09aa-76ba-4138-b1c9-2fb971b5cb49"
EMPLOYEE_MAP["สุชาติ พรดอนก่อ"]="caa6168f-83f7-4bf5-b65c-c2aade9d4ddd"
EMPLOYEE_MAP["สุรชัย อัครพิชญวริน"]="65fee7de-a6ae-40de-9dce-efde9467b67e"
EMPLOYEE_MAP["อดิศร กุลอนงค์"]="8162ef77-e2e7-498c-829b-4b8313aee8b8"
EMPLOYEE_MAP["อภิศาล สอนอุทัย"]="5ef9e0c2-5849-40fa-848b-77e70b9ede83"
EMPLOYEE_MAP["อำนวยชัย สมบัติสวัสดิ์"]="65ca908c-89d5-46e7-8ac8-caa414cab7fa"
EMPLOYEE_MAP["อิศรา อินพาเพียร"]="896ca156-a9fe-453f-a316-063b6ae474fd"
EMPLOYEE_MAP["อิสรา สุรบุตร"]="2d83e670-df88-44dd-a917-5c7ead6f5e3e"

# Images without spaces (already have images - skip these)
# ชโยดมพานิชเจริญ - HAS IMAGE
# ณรงค์ชัยบุญธรรม - HAS IMAGE
# พิมพ์ชนกเอี่ยมสำอางค์ - HAS IMAGE
# รพีพงศ์เชื้อจีนธนากุล - HAS IMAGE
# เกริกชัยกมขุนทด - HAS IMAGE

# Images without spaces that need uploading
EMPLOYEE_MAP["ชวินพานิชเจริญ"]="ca908322-874c-40bb-8e95-4085eaaf6fa1"
EMPLOYEE_MAP["ณัทธ์ฐภัคกนกเพชร"]="59f923d8-3197-45e8-9c4c-8a7c0911e124"
EMPLOYEE_MAP["ปรีชาชมความสุข"]="656b097b-ecfb-430a-a6d1-019c795204ae"
EMPLOYEE_MAP["ภาณุวัฒน์เมืองศิริ"]="19b8c525-a99a-4e3a-9947-090674b11786"
EMPLOYEE_MAP["ภูมิศักดิ์หิรัญวรรณ"]="58679f18-3989-4f74-8868-f372b32f7701"
EMPLOYEE_MAP["เตโชชโยดมเถาคำแก้ว"]="5c50aced-44a9-4546-8ec4-01ea9bf71c5e"
EMPLOYEE_MAP["ไพรัชฎ์อินทมูล"]="3b2b2816-d275-4cc3-81f1-f4bb194e04ec"
EMPLOYEE_MAP["ไพโรจน์นิจโชติ"]="01909e73-f906-45da-918c-859db03f52bc"

# SQL updates file
SQL_FILE="scripts/update-profile-urls.sql"
echo "-- SQL to update profile_image_url" > "$SQL_FILE"

# Process each image
for IMAGE_PATH in "$IMAGE_DIR"/*.jpg; do
    FILENAME=$(basename "$IMAGE_PATH" .jpg)

    if [[ -v "EMPLOYEE_MAP[$FILENAME]" ]]; then
        EMPLOYEE_ID="${EMPLOYEE_MAP[$FILENAME]}"
        DEST_PATH="${BUCKET}/${EMPLOYEE_ID}/${TIMESTAMP}.jpg"
        PUBLIC_URL="${BASE_URL}/${EMPLOYEE_ID}/${TIMESTAMP}.jpg"

        echo "Uploading: $FILENAME -> $EMPLOYEE_ID"

        # Upload file to Supabase storage
        npx supabase storage cp "$IMAGE_PATH" "ss:///${DEST_PATH}" --linked

        if [ $? -eq 0 ]; then
            echo "  SUCCESS: Uploaded to $PUBLIC_URL"
            echo "UPDATE main_employees SET profile_image_url = '${PUBLIC_URL}', updated_at = now() WHERE id = '${EMPLOYEE_ID}';" >> "$SQL_FILE"
        else
            echo "  FAILED: Could not upload $FILENAME"
        fi
    else
        echo "SKIPPED: $FILENAME (no matching employee or already has image)"
    fi
done

echo ""
echo "SQL file generated: $SQL_FILE"
echo "Run: npx supabase db push to apply updates, or use MCP execute_sql"
