// NOTE: https://github.com/aws-samples/amazon-cognito-passwordless-auth/blob/main/CUSTOMIZE-AUTH.md#1-create-your-own-lambda-function-logic-using-this-library-and-call-configure
import { magicLink } from 'amazon-cognito-passwordless-auth/custom-auth';

// Export the solution's handler to be the handler of YOUR Lambda function too:
export { createAuthChallengeHandler as handler } from 'amazon-cognito-passwordless-auth/custom-auth';

// Calling configure() without arguments retrieves the current configuration:
const defaultConfig = magicLink.configure();

// Add your own logic:
magicLink.configure({
  async contentCreator({ secretLoginLink }) {
    return {
      html: {
        data: `<html><body><p>make it ! へようこそ！</p><p><a href="${secretLoginLink}">こちら</a>からサインインして make it ! を使用することができます。</p>${Math.floor(
          defaultConfig.secondsUntilExpiry / 60,
        )} 分で有効期限が切れますのでご注意ください。<p></p></body></html>`,
        charSet: 'UTF-8',
      },
      text: {
        data: `こちらのリンクからサインインすることができます: ${secretLoginLink}`,
        charSet: 'UTF-8',
      },
      subject: {
        data: 'make it ! へようこそ！',
        charSet: 'UTF-8',
      },
    };
  },
});
