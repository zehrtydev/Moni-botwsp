import { normalizeE164 } from "../../lib/phone";

const otpPattern = /^[0-9]{6}$/;

const requestError = new Error(
  "No pudimos enviar el codigo. Intenta nuevamente.",
);
const verificationError = new Error(
  "No pudimos verificar el codigo. Solicita uno nuevo.",
);
const linkingError = new Error(
  "No pudimos vincular el numero verificado.",
);

interface AuthResult {
  error: unknown;
}

interface VerificationResult extends AuthResult {
  data: {
    session: {
      user: { id: string } | null;
    } | null;
  };
}

export interface PhoneOtpClient {
  auth: {
    signInWithOtp(input: {
      phone: string;
      options: { shouldCreateUser: true };
    }): PromiseLike<AuthResult>;
    verifyOtp(input: {
      phone: string;
      token: string;
      type: "sms";
    }): PromiseLike<VerificationResult>;
    signOut(input: { scope: "local" }): PromiseLike<AuthResult>;
  };
  rpc(name: "vincular_numero_autenticado"): PromiseLike<AuthResult>;
}

export async function requestPhoneOtp(
  client: PhoneOtpClient,
  rawPhone: string,
): Promise<void> {
  const phone = normalizeE164(rawPhone);

  try {
    const { error } = await client.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true },
    });

    if (error) {
      throw requestError;
    }
  } catch {
    throw requestError;
  }
}

export async function verifyPhoneOtpAndLink(
  client: PhoneOtpClient,
  rawPhone: string,
  token: string,
): Promise<void> {
  const phone = normalizeE164(rawPhone);

  if (!otpPattern.test(token)) {
    throw new Error("El codigo debe contener 6 digitos.");
  }

  let verification: VerificationResult;

  try {
    verification = await client.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
  } catch {
    throw verificationError;
  }

  if (
    verification.error ||
    !verification.data.session?.user?.id
  ) {
    throw verificationError;
  }

  try {
    const { error } = await client.rpc("vincular_numero_autenticado");

    if (error) {
      throw linkingError;
    }
  } catch {
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      // The public linking error remains stable even if cleanup fails.
    }

    throw linkingError;
  }
}
