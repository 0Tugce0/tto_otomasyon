"""
core/session.py — "Beni Hatırla" destekli session middleware.

Starlette'in SessionMiddleware'i tek bir sabit max_age ile çalışır (middleware
kurulurken belirlenir, request bazında değişmez). Login sayfasındaki "Beni
Hatırla" seçeneği için, işaretlendiğinde çerez ömrünü uzatan bir varyant
gerekiyor — bu yüzden Starlette'in kaynağından (starlette.middleware.sessions,
bkz. requirements.txt'teki sabitlenmiş sürüm) uyarlanmıştır.

Davranış:
  - Login endpoint'i request.session["_remember"] = True yazarsa, o oturumun
    çerezi settings.SESSION_MAX_AGE_HOURS yerine settings.SESSION_REMEMBER_ME_DAYS
    ile set edilir.
  - "_remember" yoksa/False ise davranış Starlette'in orijinaliyle birebir aynıdır.

Not: imza doğrulama (unsign) sırasında her zaman uzun süre (remember_max_age)
kullanılır — bu, "hatırlanmayan" bir oturumun imza doğrulamasını hafifçe
gevşetir (çerez zaten tarayıcı tarafından kısa max_age sonunda silinir, bu
sadece savunma katmanında ikincil bir kontrol). 2 kullanıcılı, LAN-only bir
uygulama için kabul edilebilir bir basitleştirme.
"""

import json
from base64 import b64decode, b64encode

import itsdangerous
from itsdangerous.exc import BadSignature
from starlette.datastructures import MutableHeaders
from starlette.middleware.sessions import Session, SessionMiddleware
from starlette.requests import HTTPConnection
from starlette.types import Message, Receive, Scope, Send


class RememberableSessionMiddleware(SessionMiddleware):
    def __init__(self, *args, remember_max_age: int, **kwargs):
        super().__init__(*args, **kwargs)
        self.remember_max_age = remember_max_age

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):  # pragma: no cover
            await self.app(scope, receive, send)
            return

        connection = HTTPConnection(scope)
        initial_session_was_empty = True

        if self.session_cookie in connection.cookies:
            data = connection.cookies[self.session_cookie].encode("utf-8")
            try:
                data = self.signer.unsign(data, max_age=self.remember_max_age)
                scope["session"] = Session(json.loads(b64decode(data)))
                initial_session_was_empty = False
            except BadSignature:
                scope["session"] = Session()
        else:
            scope["session"] = Session()

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                session: Session = scope["session"]
                headers = MutableHeaders(scope=message)
                if session.accessed:
                    headers.add_vary_header("Cookie")
                if session.modified and session:
                    max_age = self.remember_max_age if session.get("_remember") else self.max_age
                    data = b64encode(json.dumps(session).encode("utf-8"))
                    data = self.signer.sign(data)
                    header_value = "{session_cookie}={data}; path={path}; {max_age_part}{security_flags}".format(
                        session_cookie=self.session_cookie,
                        data=data.decode("utf-8"),
                        path=self.path,
                        max_age_part=f"Max-Age={max_age}; " if max_age else "",
                        security_flags=self.security_flags,
                    )
                    headers.append("Set-Cookie", header_value)
                elif session.modified and not initial_session_was_empty:
                    header_value = "{session_cookie}={data}; path={path}; {expires}{security_flags}".format(
                        session_cookie=self.session_cookie,
                        data="null",
                        path=self.path,
                        expires="expires=Thu, 01 Jan 1970 00:00:00 GMT; ",
                        security_flags=self.security_flags,
                    )
                    headers.append("Set-Cookie", header_value)
            await send(message)

        await self.app(scope, receive, send_wrapper)
