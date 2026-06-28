export function getRequestMeta(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    null

  const ua = request.headers.get('user-agent') ?? null

  return { ip, device: ua }
}
