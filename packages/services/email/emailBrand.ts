/**
 * Shared TrackRecord email branding.
 * Lime (#D7F229) must survive client dark-mode inversion where possible.
 */
export const EMAIL_BRAND = {
	lime: '#D7F229',
	black: '#0D0D0D',
	white: '#FFFFFF',
	cream: '#F4F2EA',
	cardBorder: '#E4E1D6',
	mutedText: '#6B6B62',
	footerText: '#9A9A90',
	slash: '#7A7A7A',
	link: '#4A5A1E'
} as const

export const escapeHtml = ({ value }: { value: string }): string => {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

/**
 * Head + dark-mode resistance styles.
 * Declares light-only color-scheme and re-asserts brand colors if a client
 * still applies prefers-color-scheme: dark (keeps lime CTA / wordmark).
 */
export const buildEmailHead = ({ title }: { title: string }): string => {
	const { lime, black, white, cream, mutedText, link, slash } = EMAIL_BRAND

	return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml({ value: title })}</title>
<style type="text/css">
  :root { color-scheme: light only; }
  @media (prefers-color-scheme: dark) {
    .email-body, .email-outer { background-color: ${cream} !important; }
    .email-card { background-color: ${white} !important; border-color: ${EMAIL_BRAND.cardBorder} !important; }
    .email-header { background-color: ${black} !important; }
    .email-wordmark { color: ${white} !important; }
    .email-wordmark-slash { color: ${slash} !important; }
    .email-wordmark-record { color: ${lime} !important; }
    .email-text { color: ${black} !important; }
    .email-muted { color: ${mutedText} !important; }
    .email-cta { background-color: ${lime} !important; }
    .email-cta a { color: ${black} !important; }
    .email-link { color: ${link} !important; }
    .email-divider { border-color: ${EMAIL_BRAND.cardBorder} !important; }
    .email-footer { color: ${EMAIL_BRAND.footerText} !important; }
  }
</style>
<!--[if mso]>
<style>
  table {border-collapse:collapse;}
  .fallback-font { font-family: Arial, sans-serif !important; }
</style>
<![endif]-->`
}

export const buildEmailWordmarkRow = (): string => {
	const { black, white, lime, slash } = EMAIL_BRAND

	return `<tr>
            <td align="left" class="email-header" bgcolor="${black}" style="padding:22px 40px; background-color:${black};">
              <span class="email-wordmark" style="font-family:Arial, Helvetica, sans-serif; font-size:20px; font-weight:700; letter-spacing:0.5px; color:${white};">TRACK<span class="email-wordmark-slash" style="color:${slash};">/</span><span class="email-wordmark-record" style="color:${lime};">RECORD</span></span>
            </td>
          </tr>`
}

export const buildEmailCtaButton = ({
	href,
	label
}: {
	href: string
	label: string
}): string => {
	const { lime, black } = EMAIL_BRAND
	const safeHref = escapeHtml({ value: href })
	const safeLabel = escapeHtml({ value: label })

	return `<tr>
            <td align="left" style="padding:28px 40px 0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" class="email-cta" bgcolor="${lime}" style="border-radius:999px; background-color:${lime};">
                    <a href="${safeHref}" target="_blank" style="display:block; padding:14px 30px; font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:700; color:${black}; text-decoration:none; border-radius:999px;">${safeLabel}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
}

export const buildEmailFallbackLink = ({
	href
}: {
	href: string
}): string => {
	const { mutedText, link } = EMAIL_BRAND
	const safeHref = escapeHtml({ value: href })

	return `<tr>
            <td class="email-muted" style="padding:20px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:20px; color:${mutedText};">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a class="email-link" href="${safeHref}" target="_blank" style="color:${link}; text-decoration:underline; word-break:break-all;">${safeHref}</a>
            </td>
          </tr>`
}
