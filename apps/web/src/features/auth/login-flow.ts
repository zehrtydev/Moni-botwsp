import {
  requestPhoneOtp,
  verifyPhoneOtpAndLink,
  type PhoneOtpClient,
} from "./phone-otp";

export type LoginStep = "phone" | "otp" | "authenticated";
export type LoginTone = "idle" | "success" | "error";

export interface LoginState {
  step: LoginStep;
  phone: string;
  message: string;
  tone: LoginTone;
}

export const initialLoginState: LoginState = {
  step: "phone",
  phone: "",
  message: "",
  tone: "idle",
};

function readFormString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function errorState(
  step: "phone" | "otp",
  phone: string,
  message: string,
): LoginState {
  return { step, phone, message, tone: "error" };
}

export async function processLoginForm(
  client: PhoneOtpClient,
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const intent = readFormString(formData, "intent");
  const phone = readFormString(formData, "phone");

  if (intent === "request") {
    if (!phone) {
      return errorState(
        "phone",
        "",
        "Ingresa tu numero en formato internacional.",
      );
    }

    try {
      await requestPhoneOtp(client, phone);
      return {
        step: "otp",
        phone,
        message: "Codigo enviado. Revisa tu telefono.",
        tone: "success",
      };
    } catch {
      return errorState(
        "phone",
        phone,
        "No pudimos enviar el codigo. Intenta nuevamente.",
      );
    }
  }

  if (intent === "verify") {
    const token = readFormString(formData, "token");

    if (!phone || !token) {
      return errorState(
        "otp",
        phone,
        "No pudimos verificar el codigo. Solicita uno nuevo.",
      );
    }

    try {
      await verifyPhoneOtpAndLink(client, phone, token);
      return {
        step: "authenticated",
        phone,
        message: "",
        tone: "success",
      };
    } catch (error) {
      const message =
        error instanceof Error &&
        error.message === "No pudimos vincular el numero verificado."
          ? error.message
          : "No pudimos verificar el codigo. Solicita uno nuevo.";

      return errorState("otp", phone, message);
    }
  }

  return errorState(
    "phone",
    phone,
    "La solicitud de acceso no es valida.",
  );
}
