declare module 'africastalking' {
  interface ATCredentials {
    apiKey: string;
    username: string;
  }

  interface SmsSendOptions {
    to: string[] | string;
    message: string;
    from?: string;
    enqueue?: boolean;
  }

  interface SmsRecipient {
    statusCode: number;
    number: string;
    status: string;
    cost: string;
    messageId: string;
  }

  interface SmsSendResponse {
    SMSMessageData: {
      Message: string;
      Recipients: SmsRecipient[];
    };
  }

  interface SmsApi {
    send(options: SmsSendOptions): Promise<SmsSendResponse>;
  }

  interface AfricasTalkingClient {
    SMS: SmsApi;
  }

  function AfricasTalking(creds: ATCredentials): AfricasTalkingClient;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  export = AfricasTalking;
}
