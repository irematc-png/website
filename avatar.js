(()=>{'use strict';
// Set this to the public URL of your deployed API, e.g. https://api.example.com/api/conversation
const API_BASE=window.DREALIMA_AVATAR_API_BASE||'http://localhost:5050';
const API_URL=window.DREALIMA_AVATAR_API_URL||`${API_BASE}/api/conversation`;
const SESSION_URL=window.DREALIMA_AVATAR_SESSION_URL||`${API_BASE}/api/avatar/session`;
const locale={tr:{hello:'Merhaba! Ben Drealima dijital asistanıyım. Salesforce, CRM, yapay zekâ ve özel yazılım hizmetlerimiz hakkında yardımcı olabilirim.',placeholder:'Sorunuzu yazın...',error:'Şu anda bağlantı kurulamadı. Lütfen biraz sonra tekrar deneyin.',unsupported:'Bu tarayıcı sesli girişi desteklemiyor. Yazabilirsiniz.',listening:'Dinliyorum...',thinking:'Yanıt hazırlanıyor...',ready:'Konuşmaya hazır'},en:{hello:'Hello! I am Drealima’s digital assistant. Ask me about Salesforce, CRM, AI and custom software.',placeholder:'Type your question...',error:'Connection unavailable. Please try again later.',unsupported:'Voice input is not supported here. Please type instead.',listening:'Listening...',thinking:'Preparing a reply...',ready:'Ready to talk'},de:{hello:'Hallo! Ich bin die digitale Assistentin von Drealima. Fragen Sie mich zu Salesforce, CRM, KI und individueller Software.',placeholder:'Ihre Frage eingeben...',error:'Verbindung nicht verfügbar. Bitte versuchen Sie es später erneut.',unsupported:'Spracheingabe wird hier nicht unterstützt. Bitte schreiben Sie.',listening:'Ich höre zu...',thinking:'Antwort wird vorbereitet...',ready:'Bereit'}};
const root=document.createElement('div');root.id='drai-root';root.innerHTML=`<button id="drai-launch" aria-label="Drealima AI asistanını aç" aria-expanded="false"><img src="avatar-portrait.jpg" alt="Drealima dijital asistan"></button><section id="drai-panel" role="dialog" aria-label="Drealima AI asistan" aria-hidden="true"><div id="drai-head"><img src="avatar-portrait.jpg" alt=""><div><strong>Drealima AI Asistan</strong><small>● Online</small></div><button id="drai-close" aria-label="Kapat">×</button></div><div id="drai-live-actions"><button type="button" id="drai-live-start">▶ Canlı Avatarı Başlat</button><button type="button" id="drai-live-stop" disabled>■ Bitir</button></div><div id="drai-video-box"><video id="drai-video" autoplay playsinline></video><div id="drai-live-caption">Bağlanmaya hazır</div></div><div id="drai-messages" role="log" aria-live="polite"></div><form id="drai-controls"><input id="drai-input" maxlength="1500" autocomplete="off" aria-label="Mesaj"><button type="button" id="drai-mic" aria-label="Mikrofon">🎙</button><button type="submit" id="drai-send">➤</button></form><div id="drai-footer"><select id="drai-lang" aria-label="Dil"><option value="tr">Türkçe</option><option value="en">English</option><option value="de">Deutsch</option></select><span id="drai-status"></span><button id="drai-sound" type="button" aria-label="Sesli yanıtı aç veya kapat" style="border:0;background:transparent;cursor:pointer">🔊</button></div></section>`;document.body.append(root);
const $=id=>document.getElementById(id);let lang=document.documentElement.lang?.slice(0,2);if(!locale[lang])lang='tr';$('drai-lang').value=lang;let sessionId=null,busy=false,sound=true,recognition=null;
const uiLabels={
 tr:{launch:'Drealima AI asistanını aç',assistant:'Drealima AI Asistan',close:'Kapat',start:'▶ Canlı Avatarı Başlat',stop:'■ Bitir',caption:'Bağlanmaya hazır',message:'Mesaj',microphone:'Mikrofon',language:'Dil',sound:'Sesli yanıtı aç veya kapat',preparing:'Canlı avatar hazırlanıyor…',tap:'Videoyu oynatmak için ekrana dokunun.',started:'Canlı görüşme başladı',ended:'Görüşme sonlandı',connected:'Bağlandı; mikrofon erişimini kontrol edin.',failed:'Canlı avatar başlatılamadı: '},
 en:{launch:'Open Drealima AI assistant',assistant:'Drealima AI Assistant',close:'Close',start:'▶ Start Live Avatar',stop:'■ End',caption:'Ready to connect',message:'Message',microphone:'Microphone',language:'Language',sound:'Toggle voice responses',preparing:'Preparing live avatar…',tap:'Tap the video to play.',started:'Live conversation started',ended:'Conversation ended',connected:'Connected; please check microphone access.',failed:'Could not start live avatar: '},
 de:{launch:'Drealima KI-Assistentin öffnen',assistant:'Drealima KI-Assistentin',close:'Schließen',start:'▶ Live-Avatar starten',stop:'■ Beenden',caption:'Bereit zum Verbinden',message:'Nachricht',microphone:'Mikrofon',language:'Sprache',sound:'Sprachausgabe ein- oder ausschalten',preparing:'Live-Avatar wird vorbereitet…',tap:'Tippen Sie auf das Video, um es abzuspielen.',started:'Live-Gespräch gestartet',ended:'Gespräch beendet',connected:'Verbunden; bitte Mikrofonzugriff prüfen.',failed:'Live-Avatar konnte nicht gestartet werden: '}
};
function applyUiLanguage(){const t=uiLabels[lang];$('drai-launch').setAttribute('aria-label',t.launch);$('drai-launch').querySelector('img').alt=t.assistant;$('drai-panel').setAttribute('aria-label',t.assistant);$('drai-head').querySelector('strong').textContent=t.assistant;$('drai-close').setAttribute('aria-label',t.close);$('drai-live-start').textContent=t.start;$('drai-live-stop').textContent=t.stop;$('drai-input').setAttribute('aria-label',t.message);$('drai-mic').setAttribute('aria-label',t.microphone);$('drai-lang').setAttribute('aria-label',t.language);$('drai-sound').setAttribute('aria-label',t.sound);if(!$('drai-video-box').classList.contains('active'))$('drai-live-caption').textContent=t.caption;}
applyUiLanguage();

function bubble(message,who){const node=document.createElement('div');node.className='drai-bubble drai-'+who;node.textContent=message;$('drai-messages').append(node);$('drai-messages').scrollTop=$('drai-messages').scrollHeight;return node}
function status(message){$('drai-status').textContent=message}function speak(message){if(!sound||!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(message);u.lang={tr:'tr-TR',en:'en-US',de:'de-DE'}[lang];u.rate=.98;window.speechSynthesis.speak(u)}
function toggle(open){$('drai-panel').classList.toggle('open',open);$('drai-panel').setAttribute('aria-hidden',String(!open));$('drai-launch').setAttribute('aria-expanded',String(open));if(open)$('drai-input').focus();else{window.speechSynthesis?.cancel();recognition?.stop()}}
$('drai-launch').onclick=()=>toggle(!$('drai-panel').classList.contains('open'));$('drai-close').onclick=()=>{toggle(false);if(liveSession)endLive()};$('drai-lang').onchange=e=>{lang=e.target.value;window.speechSynthesis?.cancel();applyUiLanguage();
// LiveAvatar uses a short-lived session token issued by the .NET backend.
// API keys must NEVER be placed in this file.
let liveSession=null,liveStarting=false,liveActive=false;
const liveStart=$('drai-live-start'),liveStop=$('drai-live-stop');
function liveCaption(message){$('drai-live-caption').textContent=message;status(message)}
function liveButtons(){liveStart.disabled=liveStarting||liveActive;liveStop.disabled=!liveActive;}
async function endLive(){
  const current=liveSession;liveSession=null;liveActive=false;liveStarting=false;
  liveButtons();$('drai-video').pause();$('drai-video').srcObject=null;
  $('drai-video-box').classList.remove('active');
  liveCaption(locale[lang].ready);
  if(current){try{await current.stop()}catch(e){console.warn('LiveAvatar stop:',e)}}
}
liveStart.onclick=async()=>{
  if(liveStarting||liveActive)return;
  liveStarting=true;liveButtons();$('drai-video-box').classList.add('active');
  liveCaption(uiLabels[lang].preparing);
  try{
    const response=await fetch(SESSION_URL,{method:'POST',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error('Session API HTTP '+response.status);
    const data=await response.json();
    if(!data.sessionToken)throw new Error('Session token missing');
    // Official HeyGen LiveAvatar browser SDK, loaded only when requested.
    const {LiveAvatarSession,SessionEvent}=await import('https://esm.sh/@heygen/liveavatar-web-sdk');
    const session=new LiveAvatarSession(data.sessionToken,{autoKeepAlive:true});
    liveSession=session;
    session.on(SessionEvent.SESSION_STREAM_READY,()=>{
      if(liveSession!==session)return;
      session.attach($('drai-video'));
      $('drai-video').play().catch(()=>liveCaption(uiLabels[lang].tap));
      liveCaption(uiLabels[lang].started);
    });
    session.on(SessionEvent.SESSION_DISCONNECTED,()=>{
      if(liveSession===session){liveSession=null;liveActive=false;liveStarting=false;liveButtons();$('drai-video').srcObject=null;liveCaption(uiLabels[lang].ended);}
    });
    await session.start();
    if(liveSession!==session){await session.stop();return;}
    liveActive=true;liveCaption(uiLabels[lang].connected);
  }catch(e){
    console.error('LiveAvatar start failed:',e);
    liveCaption(uiLabels[lang].failed+e.message);
    const current=liveSession;liveSession=null;
    if(current)try{await current.stop()}catch{}
    $('drai-video-box').classList.remove('active');
  }finally{liveStarting=false;liveButtons();}
};
liveStop.onclick=()=>endLive();
$('drai-video').onclick=()=>$('drai-video').play().catch(()=>{});
window.addEventListener('pagehide',()=>{if(liveSession)endLive()});

$('drai-input').placeholder=locale[lang].placeholder;status(locale[lang].ready);bubble(locale[lang].hello,'bot')};$('drai-sound').onclick=()=>{sound=!sound;$('drai-sound').textContent=sound?'🔊':'🔇';if(!sound)window.speechSynthesis?.cancel()};
async function send(message){message=message.trim();if(!message||busy)return;busy=true;$('drai-send').disabled=true;$('drai-input').value='';bubble(message,'user');status(locale[lang].thinking);const pending=bubble('…','bot');try{const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,language:lang,sessionId}),signal:AbortSignal.timeout(25000)});if(!res.ok)throw Error('API '+res.status);const data=await res.json();if(typeof data.message!=='string')throw Error('Invalid response');sessionId=data.sessionId||sessionId;pending.textContent=data.message;speak(data.message)}catch(e){console.warn('Drealima avatar connection issue:',e.message);pending.textContent=locale[lang].error}finally{busy=false;$('drai-send').disabled=false;status(locale[lang].ready)}}
$('drai-controls').onsubmit=e=>{e.preventDefault();send($('drai-input').value)};
$('drai-mic').onclick=()=>{const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SpeechRecognition){status(locale[lang].unsupported);return}if(recognition){recognition.stop();return}recognition=new SpeechRecognition();recognition.lang={tr:'tr-TR',en:'en-US',de:'de-DE'}[lang];recognition.interimResults=false;recognition.onresult=e=>{const words=e.results[0][0].transcript;$('drai-input').value=words;send(words)};recognition.onerror=()=>status(locale[lang].unsupported);recognition.onend=()=>{recognition=null;$('drai-mic').classList.remove('listening');status(locale[lang].ready)};recognition.start();$('drai-mic').classList.add('listening');status(locale[lang].listening)};

// LiveAvatar uses a short-lived session token issued by the .NET backend.
// API keys must NEVER be placed in this file.
let liveSession=null,liveStarting=false,liveActive=false;
const liveStart=$('drai-live-start'),liveStop=$('drai-live-stop');
function liveCaption(message){$('drai-live-caption').textContent=message;status(message)}
function liveButtons(){liveStart.disabled=liveStarting||liveActive;liveStop.disabled=!liveActive;}
async function endLive(){
  const current=liveSession;liveSession=null;liveActive=false;liveStarting=false;
  liveButtons();$('drai-video').pause();$('drai-video').srcObject=null;
  $('drai-video-box').classList.remove('active');
  liveCaption(locale[lang].ready);
  if(current){try{await current.stop()}catch(e){console.warn('LiveAvatar stop:',e)}}
}
liveStart.onclick=async()=>{
  if(liveStarting||liveActive)return;
  liveStarting=true;liveButtons();$('drai-video-box').classList.add('active');
  liveCaption(uiLabels[lang].preparing);
  try{
    const response=await fetch(SESSION_URL,{method:'POST',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error('Session API HTTP '+response.status);
    const data=await response.json();
    if(!data.sessionToken)throw new Error('Session token missing');
    // Official HeyGen LiveAvatar browser SDK, loaded only when requested.
    const {LiveAvatarSession,SessionEvent}=await import('https://esm.sh/@heygen/liveavatar-web-sdk');
    const session=new LiveAvatarSession(data.sessionToken,{autoKeepAlive:true});
    liveSession=session;
    session.on(SessionEvent.SESSION_STREAM_READY,()=>{
      if(liveSession!==session)return;
      session.attach($('drai-video'));
      $('drai-video').play().catch(()=>liveCaption(uiLabels[lang].tap));
      liveCaption(uiLabels[lang].started);
    });
    session.on(SessionEvent.SESSION_DISCONNECTED,()=>{
      if(liveSession===session){liveSession=null;liveActive=false;liveStarting=false;liveButtons();$('drai-video').srcObject=null;liveCaption(uiLabels[lang].ended);}
    });
    await session.start();
    if(liveSession!==session){await session.stop();return;}
    liveActive=true;liveCaption(uiLabels[lang].connected);
  }catch(e){
    console.error('LiveAvatar start failed:',e);
    liveCaption(uiLabels[lang].failed+e.message);
    const current=liveSession;liveSession=null;
    if(current)try{await current.stop()}catch{}
    $('drai-video-box').classList.remove('active');
  }finally{liveStarting=false;liveButtons();}
};
liveStop.onclick=()=>endLive();
$('drai-video').onclick=()=>$('drai-video').play().catch(()=>{});
window.addEventListener('pagehide',()=>{if(liveSession)endLive()});

$('drai-input').placeholder=locale[lang].placeholder;status(locale[lang].ready);bubble(locale[lang].hello,'bot');
})();
