import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

// Implicit TLS is the meaning of port 465 and of nothing else; every other
// port either negotiates it or, as the capture server in development does,
// offers none at all.
const IMPLICIT_TLS_PORT = 465;

// A transport opens no socket until something is sent, so a mail server that
// is down does not stop the application from starting, the same way the
// database connection is left lazy.
export function createMailTransport(configService: ConfigService): Transporter {
  const port = configService.getOrThrow<number>('MAIL_PORT');

  return createTransport({
    host: configService.getOrThrow<string>('MAIL_HOST'),
    port,
    secure: port === IMPLICIT_TLS_PORT,
  });
}
