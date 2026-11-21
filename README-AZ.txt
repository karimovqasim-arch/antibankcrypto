ABCR SAYT DIZAYNI — GITHUB-A YERLƏŞDIRMƏ

Bu paketdə 5 sayt faylı var:
- index.html (mövcud index.html-i əvəz edir)
- style.css (yeni fayl, kök qovluğa)
- whitepaper.html (yeni fayl, kök qovluğa)
- how-it-works.html (yeni fayl, kök qovluğa)
- vite.config.js (mövcud faylı əvəz edir: əlavə səhifələrin build-ə daxil olması üçün)

VACİB:
- src/main.js, package.json, .github/workflows/deploy.yml və abcr-icon.svg fayllarını dəyişməyin.
- vite.config.js faylını paketdəki ilə əvəz edin; base eyni qalır, yeni səhifələr build-ə əlavə olunur.
- Köhnə index.html-in ehtiyat nüsxəsini saxlayın.
- HTML-də aşağıdakı bütün ID-lər saxlanılıb:
connect, disconnect, wallet, network, balance, burn, burnAmount, claim, count, epoch, next, status.
- index.html sonundakı <script type="module" src="/src/main.js"></script> mövcud Vite quruluşuna uyğundur.
- Əvvəlki main.js-dəki wallet, burn, claim məntiqi olduğu kimi qalır.
- GitHub repo: karimovqasim-arch/antibankcrypto
- Repo əsas qovluğunda Add file -> Upload files seçib bu 5 faylı yükləyin; index.html üçün overwrite/commit təsdiq edin.
- GitHub Actions yaşıl olduqdan sonra saytı yoxlayın.

QEYD:
- Whitepaper mətnində istifadəçinin təqdim etdiyi kontrakt parametrləri əsas götürülüb. Mükafatın dəqiq paylanma alqoritmi Solidity kodu ilə tam təsdiqlənməyib. Audit və gəlir zəmanəti iddiası yoxdur.
- Mobil Desktop Site bildirişi saxlanılıb. Bu paket WalletConnect mobil deep-link problemini özlüyündə düzəltmir.
- Əgər mövcud index.html-də bu paketdə olmayan başqa xüsusi funksiya varsa, əvəz etməzdən əvvəl müqayisə edin.
