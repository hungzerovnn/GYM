# Social Bridge

`SocialBridge` la lop lien ket local cho phep tan dung may tinh da dang nhap san vao kenh social/chat de noi voi `Trung tam lien ket thiet bi`.

## Cac lop ho tro

- `PC bridge`: chay CLI tren may tinh Windows / desktop dang su dung.
- `QR / deeplink mobile`: tao link public de dien thoai dang login san mo va claim session.
- `Browser extension`: dung cho Chrome / Edge de claim session tu tab dang mo Zalo, WeChat, WhatsApp, Messenger, Telegram, Viber, LINE, KakaoTalk, Signal hoac Discord.

## Chay bridge desktop

Tao session tu portal:

- vao `Mang xa hoi > Trung tam lien ket`
- chon `PC bridge`
- copy lenh bridge hoac copy `sessionToken` / `pairCode`

Chay lenh mau:

```powershell
npm --prefix tools/SocialBridge run link -- --server "http://localhost:6273/api" --tenant "MASTER" --session-token "<SESSION_TOKEN>"
```

Hoac dung pair code:

```powershell
npm --prefix tools/SocialBridge run link -- --server "http://localhost:6273/api" --tenant "MASTER" --pair-code "AB12CD34"
```

Gui heartbeat thu cong:

```powershell
npm --prefix tools/SocialBridge run heartbeat -- --server "http://localhost:6273/api" --tenant "MASTER"
```

Chay heartbeat vong lap:

```powershell
npm --prefix tools/SocialBridge run run -- --server "http://localhost:6273/api" --tenant "MASTER" --interval 45
```

## Noi luu config

Bridge se tu dong luu secret vao:

- Windows: `%APPDATA%\\FitFlowSocialBridge\\config.json`
- Neu co env `FITFLOW_SOCIAL_BRIDGE_CONFIG` thi uu tien dung path do

## Browser extension

Thu muc:

- [manifest.json](c:\xampp\htdocs\GYM\tools\SocialBridge\browser-extension\manifest.json)
- [popup.html](c:\xampp\htdocs\GYM\tools\SocialBridge\browser-extension\popup.html)
- [popup.js](c:\xampp\htdocs\GYM\tools\SocialBridge\browser-extension\popup.js)

Nap extension `Load unpacked` trong Chrome / Edge, sau do claim session bang `session token` hoac `pair code`.
