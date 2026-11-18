# Reels filtr · React Native + Expo

Aplikace pro iPhone v **React Native, TypeScriptu a Expo SDK 58**. Rozhraní ovládá vlastní lokální modul pro iOS. Prototyp pracuje s původním Instagramem z App Storu: při rozpoznání přehrávače Reels přes systémové vysílání obrazovky dočasně překryje vybranou aplikaci blokací Času u obrazovky.

**Záložku Reels neodstraňuje.** Po dobu blokace se pozastaví celý Instagram včetně zpráv. Rozpoznávání je experimentální, založené na OCR a rozmístění prvků v českém/anglickém rozhraní, nikoli na natrénovaném modelu. Funkčnost a přesnost v Instagramu na fyzickém iPhonu zatím nejsou ověřené.

## Rychlé otevření rozhraní

Použij Node.js 24 LTS (`nvm use`, pokud používáš nvm):

```sh
npm ci
npx expo login
npm start
```

V přihlášení otevřeném příkazem `npx expo login` použij svůj Expo účet. Na iPhonu se v Expo Go přihlas **stejným účtem** přes ikonu účtu. Jde o přihlášení do Expa, ne do Apple účtu ani Instagramu. Samotné přihlášení na webu Expo nestačí, pokud se nedokončí propojení s příkazovým řádkem. Stav na Macu ověříš příkazem `npx expo whoami`. Tuto podmínku má aktuální Expo Go na fyzickém iPhonu; viz [pokyny Expa k přihlášení](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/).

QR kód běžícího serveru otevři fotoaparátem iPhonu s nainstalovaným Expo Go. Obě zařízení mají být na stejné Wi-Fi. QR kód na webu v kroku „Download Expo Go“ instaluje Expo Go; pro náš projekt použij QR kód z běžícího serveru. V Expo Go funguje **náhled obrazovek**, včetně nápovědy; ochrana je označená jako nedostupná a nejde zapnout. Expo Go nemůže obsahovat náš vlastní iOS modul ani vysílací rozšíření. Webový náhled spustíš `npm run web`.

## Sestavení skutečné ochrany pro iPhone

Potřebuješ Mac s Xcode, CocoaPods, připojený iPhone a **aktivní placené členství Apple Developer Program**. Bezplatný Personal Team nepodporuje Family Controls. Členství za tebe projekt neobjednává ani nehradí.

```sh
# Vygeneruje iOS aplikaci, vysílací rozšíření a obrazovku blokace.
npm run prebuild:guard

# Sestaví a nainstaluje vlastní vývojovou verzi na připojený iPhone.
npm run ios:guard

# Při dalších úpravách TypeScriptu použij stejný vývojový klient:
npm run start:dev
```

Pokud je potřeba vlastní identifikátor, nastav `REELS_BUNDLE_ID` při **obou** prvních příkazech. Výchozí je `cz.numsik.reelsfiltr`. Identifikátory rozšíření i sdílená skupina se odvodí automaticky. Vygenerovaný projekt `ios/Reelsfiltr.xcworkspace` lze po instalaci CocoaPods otevřít v Xcode. Stejný placený tým musí být nastavený u aplikace i obou rozšíření. Pro distribuční sestavení/TestFlight je potřeba další schválení Family Controls od Apple pro všechny příslušné identifikátory.

`npm run prebuild:ios` vygeneruje náhledovou verzi bez omezených oprávnění; tu lze podepsat Personal Teamem, ale ochrana v ní není dostupná. Přepnutí režimu prováděj přes tyto příkazy, které znovu vytvoří generovanou složku `ios/`. Ruční úpravy v této složce se při regeneraci ztratí; zdrojem nastavení je `app.config.ts` a plugin.

`eas.json` obsahuje profily `preview`, `development` a `production`. Použití cloudového sestavení vyžaduje vlastní Expo účet a propojení projektu; účet ani cloudové sestavení nebyly v rámci této změny vytvářené.

## Použití a ověření na telefonu

1. V aplikaci povol Čas u obrazovky. Odmítnuté oprávnění nesmí zobrazovat aktivní ochranu.
2. Vyber **pouze Instagram**, bez kategorií a webů. iOS aplikaci poskytuje anonymní token, proto její název nelze automaticky ověřit. Výběr jiné aplikace by blokoval ji.
3. Zapni přepínač ochrany. Klepni na systémové tlačítko vysílání v kroku 3 a potvrď **Zahájit vysílání** pro Reels filtr. Mikrofon není potřeba.
4. Vrať se do filtru a ověř stav **Ochrana běží**. Otevři původní Instagram. Ověř samostatně zprávy, fotopříspěvek a profil — nemají vyvolat blokaci.
5. Otevři přehrávač Reels. Tři po sobě rozpoznané snímky mají vyvolat blokaci přibližně na 30 sekund. Po uvolnění je 8 sekund na odchod z Reels do zpráv či na profil.
6. Vypni ochranu a ověř okamžité uvolnění Instagramu. Ukonči systémové vysílání a ověř, že filtr zobrazí neaktivní stav. Vyzkoušej také zamknutí a odemknutí telefonu a případné nové spuštění vysílání.

Časování závisí na běhu vysílacího rozšíření. Když iOS rozšíření neočekávaně ukončí, blokace může zůstat aktivní do otevření Reels filtru; aplikace zkontroluje zastaralý stav a uvolní ji. Rozpoznávání může Reels přehlédnout nebo se splést; změny rozhraní Instagramu, jazyk, velikost textu a rozlišení ovlivňují výsledek. Rozšíření nezná identitu právě zobrazené aplikace a vyhodnocuje pouze podobu obrazovky. Před běžným používáním je nutné zařízení skutečně otestovat.

## Soukromí

Vysílací rozšíření zpracovává zhruba jeden snímek za 1,1 sekundy přes Apple Vision. Zvuk ignoruje. Snímky ani přečtený text neukládá a neodesílá. Sdílené místní úložiště obsahuje nastavení, anonymní výběr aplikace a časové údaje o běhu a blokaci. Hostitelská aplikace nečte účet, heslo ani zprávy Instagramu. Vývojový klient Expo používá síť pro načítání vývojového JavaScriptu.

## Struktura

- `App.tsx` — české rozhraní, nastavení, skutečný stav ochrany a nápověda.
- `modules/reels-guard/` — lokální Expo modul: oprávnění, systémový výběr aplikace, ovládání a systémové tlačítko vysílání.
- `modules/reels-guard/ios/Shared/` — sdílené nastavení a pravidla rozpoznávání.
- `native/broadcast/` — ReplayKit + Vision, sledování běhu a vynucení blokace.
- `native/shield/` — podoba blokovací obrazovky.
- `plugins/withReelsGuard.cjs` — opakovatelné vytvoření iOS rozšíření a oprávnění při Expo prebuild.
- `legacy/safari/` — zachovaná původní verze se Safari rozšířením. Nové Expo sestavení ji neobsahuje.

## Kontroly

```sh
npm run typecheck
npm test
npm run test:native
npx expo export --platform web
```

Swift testy ověřují pravidla a požadavek na opakované rozpoznání na syntetických textových oblastech. **Neprokazují přesnost na skutečných snímcích Instagramu.** JavaScriptové testy ověřují archivované Safari rozšíření. Pro skutečnou ochranu je nutné ověření na fyzickém iPhonu podle postupu výše.

Při převodu prošla typová kontrola TypeScriptu, všech 15 testů původního rozšíření, 7 Swift testů detektoru, export JavaScriptu pro iOS i web a všech 20 kontrol Expo Doctor. Prošlo také celé sestavení pro zařízení v Xcode se zakázaným podepisováním, včetně nativního Expo modulu a obou rozšíření. Webové rozhraní bylo vizuálně ověřené v šířce 393 bodů. Podpis, instalace a rozpoznávání v Instagramu na fyzickém iPhonu zůstávají neověřené.

## Dokumentace

- [Expo: vlastní vývojová verze aplikace](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo: rozšíření iOS](https://docs.expo.dev/build-reference/app-extensions/)
- [Apple: Family Controls](https://developer.apple.com/documentation/Xcode/configuring-family-controls)
- [Apple: podporovaná oprávnění a typy členství](https://developer.apple.com/help/account/reference/supported-capabilities-ios)
