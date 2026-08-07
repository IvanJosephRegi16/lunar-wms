// Google Service Account credentials for Drive backup
export const GOOGLE_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: process.env.GOOGLE_PROJECT_ID || "viking-lunar",
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || "",
  private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL || "viking-backup@viking-lunar.iam.gserviceaccount.com",
  client_id: process.env.GOOGLE_CLIENT_ID || "",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL || "",
  universe_domain: "googleapis.com"
};

export const GOOGLE_DRIVE_FOLDER_ID = "1KLuw-jf7H2A0FSY966a_sW_wQ0tWhuI_";
