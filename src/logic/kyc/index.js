import { readBody } from "~/lib/read-body.js";
import { getClientIds } from "~/logic/client.js";
import * as events from "~/api/events/index.js";
import { KycWebhookBodySizeMax, KycWebhookStatus } from "~/const.js";

export const createSession = async (ctx, did) => {
  const { kyc } = ctx;

  const session = await kyc.createSession(did);
  const { state } = session;

  const clientIds = getClientIds(ctx, did);
  await events.kyc.stateUpdated(ctx, clientIds, state);

  return session;
};

export const createKycWebhook = (ctx) => async (req, res) => {
  const { kyc } = ctx;
  const { url, method, headers } = req;

  const end = (code = 200) => res.writeHead(code).end();

  try {
    const base = `https://${headers.host}`;
    const fullUrl = new URL(url, base);

    const isWebhook = await kyc.isWebhook(method, fullUrl, headers);
    if (!isWebhook) {
      return end(404);
    }

    const body = await readBody(req, KycWebhookBodySizeMax);
    if (!body) {
      return end(413);
    }

    const [webhookStatus, did, state] = await kyc.webhook(
      headers,
      fullUrl,
      body,
    );
    switch (webhookStatus) {
      case KycWebhookStatus.ok:
        break;
      case KycWebhookStatus.notExist:
        return end();
      case KycWebhookStatus.badRequest:
        return end(400);
      case KycWebhookStatus.authError:
        return end(401);
      default:
        return end(500);
    }

    const clientIds = getClientIds(ctx, did);
    await events.kyc.stateUpdated(ctx, clientIds, state);

    end();
  } catch (e) {
    console.error("kyc-webhook: failed", e);
    return end(500);
  }
};
