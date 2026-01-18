/**
 * Script to upload profile images to Supabase storage and update employee records
 * Run with: deno run --allow-read --allow-run scripts/upload-profile-images.ts
 */

// Mapping of image filename (without .jpg) to employee ID
const employeeMap: Record<string, string> = {
  // Images with spaces in filenames
  "สุทธิพร  พรหมเพศ": "b1b81f9c-9048-45d6-a0db-2b3b80005314",
  "รวี สวนสมุทร": "86f42b8f-e992-47cb-be0f-8e81ebddcd09",
  "วัชรินทร์ แซ่จิว": "70142883-b78a-4589-8352-e27e69adbee5",
  "วันเฉลิม จิบจันทร์": "1da007c0-8513-4292-9d5b-6bde3e7c1600",
  "วีรศักดิ์ ชมความสุข": "8a2f09aa-76ba-4138-b1c9-2fb971b5cb49",
  "สุชาติ พรดอนก่อ": "caa6168f-83f7-4bf5-b65c-c2aade9d4ddd",
  "สุรชัย อัครพิชญวริน": "65fee7de-a6ae-40de-9dce-efde9467b67e",
  "อดิศร กุลอนงค์": "8162ef77-e2e7-498c-829b-4b8313aee8b8",
  "อภิศาล สอนอุทัย": "5ef9e0c2-5849-40fa-848b-77e70b9ede83",
  "อำนวยชัย สมบัติสวัสดิ์": "65ca908c-89d5-46e7-8ac8-caa414cab7fa",
  "อิศรา อินพาเพียร": "896ca156-a9fe-453f-a316-063b6ae474fd",
  "อิสรา สุรบุตร": "2d83e670-df88-44dd-a917-5c7ead6f5e3e",

  // Images without spaces (need uploading)
  "ชวินพานิชเจริญ": "ca908322-874c-40bb-8e95-4085eaaf6fa1",
  "ณัทธ์ฐภัคกนกเพชร": "59f923d8-3197-45e8-9c4c-8a7c0911e124",
  "ปรีชาชมความสุข": "656b097b-ecfb-430a-a6d1-019c795204ae",
  "ภาณุวัฒน์เมืองศิริ": "19b8c525-a99a-4e3a-9947-090674b11786",
  "ภูมิศักดิ์หิรัญวรรณ": "58679f18-3989-4f74-8868-f372b32f7701",
  "เตโชชโยดมเถาคำแก้ว": "5c50aced-44a9-4546-8ec4-01ea9bf71c5e",
  "ไพรัชฎ์อินทมูล": "3b2b2816-d275-4cc3-81f1-f4bb194e04ec",
  "ไพโรจน์นิจโชติ": "01909e73-f906-45da-918c-859db03f52bc",
};

const BUCKET = "profile-image";
const PROJECT_REF = "ogzyihacqbasolfxymgo";
const BASE_URL = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/${BUCKET}`;
const IMAGE_DIR = "resource/profile-image";

interface UploadResult {
  employeeId: string;
  filename: string;
  publicUrl: string;
  success: boolean;
  error?: string;
}

async function uploadImage(
  filename: string,
  employeeId: string
): Promise<UploadResult> {
  const timestamp = Date.now();
  const sourcePath = `${IMAGE_DIR}/${filename}.jpg`;
  const destPath = `ss:///${BUCKET}/${employeeId}/${timestamp}.jpg`;
  const publicUrl = `${BASE_URL}/${employeeId}/${timestamp}.jpg`;

  console.log(`\nUploading: ${filename} -> ${employeeId}`);

  const process = new Deno.Command("npx", {
    args: ["supabase", "storage", "cp", sourcePath, destPath, "--linked"],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await process.output();

  if (code === 0) {
    console.log(`  SUCCESS: ${publicUrl}`);
    return { employeeId, filename, publicUrl, success: true };
  } else {
    const error = new TextDecoder().decode(stderr);
    console.log(`  FAILED: ${error}`);
    return { employeeId, filename, publicUrl, success: false, error };
  }
}

async function main() {
  console.log("=== Profile Image Upload Script ===\n");

  // Read all jpg files in image directory
  const results: UploadResult[] = [];
  const sqlStatements: string[] = [];

  for (const [filename, employeeId] of Object.entries(employeeMap)) {
    // Check if file exists
    try {
      await Deno.stat(`${IMAGE_DIR}/${filename}.jpg`);
    } catch {
      console.log(`SKIP: ${filename}.jpg not found`);
      continue;
    }

    const result = await uploadImage(filename, employeeId);
    results.push(result);

    if (result.success) {
      sqlStatements.push(
        `UPDATE main_employees SET profile_image_url = '${result.publicUrl}', updated_at = now() WHERE id = '${result.employeeId}';`
      );
    }
  }

  // Write SQL file
  const sqlContent = `-- SQL to update profile_image_url\n-- Generated at ${new Date().toISOString()}\n\n${sqlStatements.join("\n")}`;
  await Deno.writeTextFile("scripts/update-profile-urls.sql", sqlContent);

  // Summary
  console.log("\n=== Summary ===");
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  console.log(`Uploaded: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`\nSQL file: scripts/update-profile-urls.sql`);

  // Print SQL for MCP execution
  if (sqlStatements.length > 0) {
    console.log("\n=== SQL to execute ===\n");
    console.log(sqlStatements.join("\n"));
  }
}

main();
