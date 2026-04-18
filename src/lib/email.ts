import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'goGMO <noreply@resend.dev>'

/**
 * 發送 Email 驗證信
 */
export async function sendVerificationEmail(email: string, verifyUrl: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF7F2; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: #FF385C; border-radius: 12px; line-height: 48px; font-size: 24px; color: white; margin-bottom: 12px;">✈</div>
      <h1 style="color: #222222; font-size: 20px; margin: 0 0 8px;">goGMO 機場接送</h1>
      <p style="color: #717171; font-size: 14px; margin: 0;">驗證您的 Email 帳號</p>
    </div>
    <p style="color: #222222; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      感謝您註冊 goGMO！請點擊下方按鈕驗證您的 Email，完成帳號開通。
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${verifyUrl}" style="display: inline-block; background: #FF385C; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600;">
        驗證 Email
      </a>
    </div>
    <p style="color: #717171; font-size: 12px; line-height: 1.6; border-top: 1px solid #DDDDDD; padding-top: 16px; margin: 0;">
      如果按鈕無法點擊，請複製以下連結到瀏覽器開啟：<br/>
      <a href="${verifyUrl}" style="color: #0C447C; word-break: break-all;">${verifyUrl}</a>
    </p>
    <p style="color: #B0B0B0; font-size: 11px; text-align: center; margin: 20px 0 0;">
      此連結 24 小時內有效，請勿轉寄給他人。
    </p>
  </div>
</body>
</html>
  `.trim()

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: '【goGMO】請驗證您的 Email 帳號',
      html,
    })
  } catch (error) {
    console.error('[EMAIL] Failed to send verification email:', error)
  }
}

/**
 * 發送密碼重設信
 */
export async function sendResetPasswordEmail(email: string, resetUrl: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF7F2; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: #FF385C; border-radius: 12px; line-height: 48px; font-size: 24px; color: white; margin-bottom: 12px;">✈</div>
      <h1 style="color: #222222; font-size: 20px; margin: 0 0 8px;">goGMO 機場接送</h1>
      <p style="color: #717171; font-size: 14px; margin: 0;">密碼重設請求</p>
    </div>
    <p style="color: #222222; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      我們收到了您的密碼重設請求。若您本人所為，請點擊下方按鈕重設密碼。若您未提出此請求，請忽略此封信。
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${resetUrl}" style="display: inline-block; background: #FF385C; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600;">
        重設密碼
      </a>
    </div>
    <p style="color: #717171; font-size: 12px; line-height: 1.6; border-top: 1px solid #DDDDDD; padding-top: 16px; margin: 0;">
      如果按鈕無法點擊，請複製以下連結到瀏覽器開啟：<br/>
      <a href="${resetUrl}" style="color: #0C447C; word-break: break-all;">${resetUrl}</a>
    </p>
    <p style="color: #B0B0B0; font-size: 11px; text-align: center; margin: 20px 0 0;">
      此連結 1 小時內有效，請勿轉寄給他人。
    </p>
  </div>
</body>
</html>
  `.trim()

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: '【goGMO】密碼重設連結',
      html,
    })
  } catch (error) {
    console.error('[EMAIL] Failed to send reset password email:', error)
  }
}
