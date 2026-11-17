# Reels filtr pro iPhone

Reels filtr je aplikace pro iOS 16 a novější s rozšířením Safari. Ve webovém Instagramu skrývá odkazy na Reels v navigaci, profilech a mřížkách. Ve feedu skryje kartu, pokud její vlastní odkaz u časového údaje vede na Reel. Přímé adresy Reels vrací na domovskou stránku Instagramu. Běžné příspěvky a zprávy zůstávají dostupné. Oficiální aplikace Instagram běží odděleně od Safari.

Rozšíření pracuje lokálně na stránkách `instagram.com` a `www.instagram.com`. Kód rozšíření žádná data neukládá ani neodesílá.

## Spuštění

1. Otevři `ReelsFiltr.xcodeproj` v plném Xcode a vyber schéma **ReelsFiltr**.
2. Vyber iOS simulátor nebo připojený iPhone. Pro iPhone nastav v **Signing & Capabilities** stejný tým pro `ReelsFiltr` i `ReelsFiltrExtension`. Pokud Xcode hlásí obsazený identifikátor, změň identifikátor aplikace i prefix identifikátoru rozšíření.
3. Spusť aplikaci v Xcode. V Nastavení vyhledej Safari, otevři **Rozšíření** a zapni **Reels filtr**.
4. V Safari ručně otevři `instagram.com` a povol rozšíření přístup k webu přes nabídku stránky.

## Ověření v Safari

- V navigaci by měl zmizet odkaz na Reels. Na profilu zkontroluj i záložku Reels.
- Otevři v adresním řádku `https://www.instagram.com/reels/`. Safari by se mělo vrátit na úvod Instagramu.
- Ověř v přihlášeném účtu, že lze otevřít běžný příspěvek, profil a zprávy.
- Instagram může měnit strukturu feedu. Když konkrétní karta zůstane viditelná, zaznamenej místo, kde se zobrazila, a verzi iOS pro další test.

[Pokyny Apple pro testování Safari rozšíření](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)
