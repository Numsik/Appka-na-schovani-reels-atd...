import { useEffect, useState } from 'react';
import {
  ActivityIndicator, AppState, Linking, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  BroadcastPicker, getGuardState, requestAuthorization, selectInstagram,
  setGuardEnabled, type GuardState,
} from './modules/reels-guard';

const colors = {
  bg: '#0C1210', card: '#18221D', line: '#2B3931', text: '#F2F5ED',
  muted: '#A8B5AC', green: '#C2F89B', darkGreen: '#263D2D', amber: '#EBD098',
};

function AppScreen() {
  const [state, setState] = useState<GuardState>(getGuardState);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const refresh = () => { setState(getGuardState()); setNow(Date.now()); };
    const timer = setInterval(refresh, 1500);
    const listener = AppState.addEventListener('change', next => { if (next === 'active') refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);

  async function perform(name: string, action: () => Promise<GuardState>) {
    setBusy(name);
    setMessage(null);
    try { setState(await action()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Akce se nepovedla. Zkus to znovu.'); }
    finally { setBusy(null); }
  }
  const authorized = state.authorization === 'approved';
  const selected = state.selectedAppCount === 1;
  const active = state.available && authorized && selected && state.enabled && state.broadcasting;
  const blocked = active && state.blockedUntil > now;
  const status = !state.available ? 'NÁHLED APLIKACE' : blocked ? 'REELS MAJÍ PAUZU'
    : active ? 'OCHRANA BĚŽÍ' : state.enabled ? 'ČEKÁ NA VYSÍLÁNÍ' : 'OCHRANA JE VYPNUTÁ';

  async function openInstagram() {
    try {
      if (Platform.OS !== 'ios') { setMessage('Instagram otevři na svém iPhonu.'); return; }
      await Linking.openURL('instagram://app');
    } catch { setMessage('Instagram se nepodařilo otevřít. Zkontroluj, že je nainstalovaný.'); }
  }

  return <SafeAreaView style={styles.safe}>
    <StatusBar style="light" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logo}><Ionicons name="leaf-outline" size={23} color={colors.bg} /></View>
          <Text style={styles.brandName}>reels filtr<Text style={{ color: colors.green }}>.</Text></Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Jak funguje ochrana" onPress={() => setHelp(true)} style={styles.helpButton}>
          <Ionicons name="help-outline" color={colors.text} size={21} />
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: active ? colors.green : colors.amber }]} />
        <Text style={styles.eyebrow}>{status}</Text>
      </View>
      <Text style={styles.title}>Méně scrollu.{ '\n' }Více prostoru.</Text>
      <Text style={styles.intro}>Zůstaň v kontaktu. Nekonečný proud Reels{ '\n' }nech na chvíli stát.</Text>

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.instagramIcon}><Ionicons name="logo-instagram" size={28} color={colors.text} /></View>
          <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Instagram</Text><Text style={styles.caption}>Tvoje aplikace. Víc klidu.</Text></View>
          <Switch accessibilityLabel="Zapnout ochranu před Reels" value={state.enabled}
            disabled={!state.available || busy !== null || (!state.enabled && (!authorized || !selected))}
            onValueChange={value => perform('toggle', () => setGuardEnabled(value))}
            trackColor={{ false: '#435047', true: colors.green }} thumbColor={colors.text} />
        </View>
        <View style={styles.divider} />
        <View style={styles.feature}><Ionicons name="chatbubbles-outline" size={17} color={colors.green} /><Text style={styles.featureText}>Zprávy, fotky a profil zůstávají v Instagramu</Text></View>
        <View style={styles.feature}><Ionicons name="pause-circle-outline" size={17} color={colors.green} /><Text style={styles.featureText}>Rozpoznané Reels spustí 30 sekund pauzy</Text></View>
        <View style={styles.note}><Text style={styles.noteText}>Záložka Reels zůstane viditelná. Při rozpoznání se dočasně zablokuje celý Instagram včetně zpráv.</Text></View>
      </View>

      {!state.available && <View style={styles.preview}>
        <Ionicons name="information-circle-outline" size={21} color={colors.amber} />
        <View style={{ flex: 1 }}><Text style={styles.previewTitle}>Teď si prohlížíš náhled</Text>
          <Text style={styles.caption}>Skutečná ochrana potřebuje plnou verzi pro iPhone. V tomto náhledu Instagram neblokujeme.</Text></View>
      </View>}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Připrav si ochranu</Text><Text style={styles.small}>{[authorized, selected, state.broadcasting].filter(Boolean).length} / 3</Text></View>
      <View style={styles.steps}>
        <Step index={1} title="Povol Čas u obrazovky" subtitle={state.authorization === 'denied' ? 'Přístup je zamítnutý. Povol ho v Nastavení.' : 'Dovol filtru krátce pozastavit Instagram.'}
          done={authorized} label="Povolit" disabled={!state.available || busy !== null} busy={busy === 'permission'}
          onPress={() => perform('permission', requestAuthorization)} />
        <View style={styles.stepDivider} />
        <Step index={2} title="Vyber pouze Instagram" subtitle="V seznamu vyber jednu aplikaci: Instagram."
          done={selected} label={selected ? 'Změnit' : 'Vybrat'} disabled={!state.available || !authorized || busy !== null} busy={busy === 'picker'}
          onPress={() => perform('picker', selectInstagram)} />
        <View style={styles.stepDivider} />
        <View style={styles.step}>
          <StepNumber index={3} done={state.broadcasting} />
          <View style={styles.stepContent}><Text style={styles.stepTitle}>Spusť vysílání obrazovky</Text>
            <Text style={styles.caption}>Nejdřív zapni přepínač výše. Pak klepni na vysílání a potvrď spuštění.</Text></View>
          {state.available && state.enabled && authorized && selected
            ? <BroadcastPicker />
            : <Ionicons name="radio-outline" size={25} color={colors.muted} style={{ margin: 12, opacity: 0.4 }} />}
        </View>
      </View>

      {blocked && <View style={styles.feedback}><Text style={styles.previewTitle}>Právě běží krátká pauza</Text><Text style={styles.caption}>Instagram bude dostupný přibližně za {Math.ceil((state.blockedUntil - now) / 1000)} s.</Text></View>}
      {state.available && state.enabled && !state.broadcasting && <Text style={styles.warning}>Ochrana zatím neběží. Spusť vysílání obrazovky v kroku 3.</Text>}
      {message && <Text accessibilityRole="alert" style={styles.warning}>{message}</Text>}

      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.8 }]} onPress={openInstagram}>
        <Text style={styles.primaryText}>Otevřít Instagram</Text><Ionicons name="arrow-forward" size={20} color={colors.bg} />
      </Pressable>
      <View style={styles.privacy}><Ionicons name="lock-closed-outline" size={13} color={colors.muted} /><Text style={styles.small}>Obraz se zpracovává v telefonu. Nikam se neodesílá.</Text></View>
      <Text style={styles.beta}>Zkušební rozpoznávání · může se splést nebo Reels přehlédnout.</Text>
    </ScrollView>

    <Modal visible={help} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHelp(false)}>
      <SafeAreaView style={[styles.safe, { padding: 26 }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={[styles.title, { fontSize: 30 }]}>Jak to funguje</Text>
        <Text style={styles.helpText}>Telefon při zapnutém vysílání hledá na obrazovce znaky přehrávače Reels. Když je rozpozná opakovaně, na 30 sekund překryje vybranou aplikaci blokací.</Text>
        <Text style={styles.helpText}>Po pauze máš 8 sekund na přechod do zpráv nebo na profil. Instagram zůstává původní aplikací z App Storu.</Text>
        <Text style={styles.helpText}>Text obrazovky se zpracovává pouze v paměti telefonu. Snímky ani přečtený text se neukládají a nikam neodesílají. Vysílání ukončíš červeným indikátorem systému; tím se ukončí i ochrana.</Text>
        <Text style={styles.helpText}>Rozpoznávání je experimentální. Ochrana při zamknutí telefonu může skončit; po odemčení ověř stav a případně vysílání spusť znovu.</Text>
        <Pressable accessibilityRole="button" onPress={() => setHelp(false)} style={styles.primaryButton}><Text style={styles.primaryText}>Rozumím</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

function StepNumber({ index, done }: { index: number; done: boolean }) {
  return <View style={[styles.stepNumber, done && { backgroundColor: colors.darkGreen }]}>{done
    ? <Ionicons name="checkmark" size={18} color={colors.green} /> : <Text style={styles.stepIndex}>{index}</Text>}</View>;
}

function Step({ index, title, subtitle, done, label, disabled, busy, onPress }: {
  index: number; title: string; subtitle: string; done: boolean; label: string;
  disabled: boolean; busy: boolean; onPress: () => void;
}) {
  return <View style={styles.step}>
    <StepNumber index={index} done={done} />
    <View style={styles.stepContent}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.caption}>{subtitle}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${title}`} disabled={disabled}
      onPress={onPress} style={[styles.stepAction, disabled && { opacity: 0.35 }]}>
      {busy ? <ActivityIndicator size="small" color={colors.green} /> : <Text style={styles.stepActionText}>{label}</Text>}
    </Pressable>
  </View>;
}

export default function App() { return <SafeAreaProvider><AppScreen /></SafeAreaProvider>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 18, paddingBottom: 34, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  brand: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  logo: { backgroundColor: colors.green, width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.8 },
  helpButton: { height: 44, width: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  title: { color: colors.text, fontSize: 43, lineHeight: 48, letterSpacing: -1.7, fontWeight: '600' },
  intro: { fontSize: 15, lineHeight: 23, color: colors.muted, marginTop: 15, marginBottom: 28 },
  hero: { padding: 20, backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.line },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  instagramIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#2B3830', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 3 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 18 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  featureText: { color: colors.text, fontSize: 12, flex: 1, lineHeight: 18 },
  note: { padding: 12, borderRadius: 12, backgroundColor: '#111B15', marginTop: 2 },
  noteText: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  preview: { flexDirection: 'row', gap: 10, paddingVertical: 17, alignItems: 'flex-start' },
  previewTitle: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 16 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  small: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  steps: { borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 },
  stepNumber: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#202C25', alignItems: 'center', justifyContent: 'center' },
  stepIndex: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  stepContent: { flex: 1 },
  stepTitle: { color: colors.text, fontWeight: '600', fontSize: 12, marginBottom: 5 },
  stepAction: { minWidth: 54, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  stepActionText: { color: colors.green, fontSize: 12, fontWeight: '600' },
  stepDivider: { height: 1, backgroundColor: colors.line, marginLeft: 39 },
  primaryButton: { minHeight: 54, backgroundColor: colors.green, borderRadius: 17, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', padding: 15, marginTop: 24 },
  primaryText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  privacy: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 18 },
  beta: { color: colors.muted, fontSize: 10, textAlign: 'center', lineHeight: 16, marginTop: 7 },
  warning: { color: colors.amber, fontSize: 12, lineHeight: 19, marginTop: 14 },
  feedback: { padding: 16, borderRadius: 15, backgroundColor: colors.darkGreen, marginTop: 15 },
  helpText: { color: colors.muted, fontSize: 15, lineHeight: 24, marginTop: 22 },
});
