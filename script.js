// ============================================================
// script.js
// Tre uavhengige oppgaver. Hver er kommentert, slik at filen
// også fungerer som notater til deg selv — les den ovenfra og ned.
//
//   1. Kontaktinfo som blir klikkbar uten å ligge lesbart i koden,
//      og som står vanlig på papir
//   2. Statuslinja i toppen
//   3. Loggen som glir inn når du scroller (og som IKKE gjør det
//      ved utskrift)
// ============================================================


// ============================================================
// 1. Kontaktinfo — lesbar for mennesker, kjedelig for scrapere
// ============================================================
//
// I index.html står adressen skrevet "Morten.Huvestad at Yahoo dot com",
// og som <span>, ikke <a>. Det betyr at den sammensatte adressen ikke
// finnes NOEN steder i kildekoden — verken i teksten, i en href eller i
// et data-attributt. En robot som leter etter mønsteret "noe@noe.no" i
// HTML-en finner ingenting.
//
// Vi setter den sammen først når noen faktisk trykker, ut fra teksten
// som allerede står der. Da fungerer den som en vanlig lenke på mobil,
// uten at den ligger klar til å høstes.
//
// Ærlig om begrensningen: en scraper som kjører en ekte nettleser kommer
// forbi dette. Men det gjør den forbi alt som ikke er et bilde, og de
// aller fleste leser bare rå HTML.

function byggKontaktadresse(tekst, type) {
  if (type === "epost") {
    return "mailto:" + tekst
      .replace(/\s+at\s+/i, "@")
      .replace(/\s+dot\s+/gi, ".");
  }
  // Telefon: fjern alle mellomrom, behold pluss og siffer.
  return "tel:" + tekst.replace(/\s+/g, "");
}

document.querySelectorAll(".contact").forEach((el) => {
  const type = el.dataset.contact;
  if (!type) return;

  // Uten JavaScript er dette ren tekst. Med JavaScript gjør vi den til
  // noe som ser ut som, og oppfører seg som, en lenke — også for
  // tastatur og skjermlesere. Det er derfor role og tabindex settes her
  // og ikke i HTML-en: de skal bare gjelde når klikket faktisk virker.
  el.classList.add("is-link");
  el.setAttribute("role", "link");
  el.setAttribute("tabindex", "0");

  const apne = () => {
    window.location.href = byggKontaktadresse(el.textContent.trim(), type);
  };

  el.addEventListener("click", apne);
  el.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      apne();
    }
  });
});

// Ved utskrift står e-postadressen vanlig. En PDF leses av et menneske,
// ikke av en robot, og «at … dot …» ser rart ut på papir. Teksten byttes
// bare mens utskriften pågår og settes tilbake etterpå, så siden er like
// kjedelig for roboter som før.
const epostFelt = document.querySelectorAll('.contact[data-contact="epost"]');

window.addEventListener("beforeprint", () => {
  epostFelt.forEach((el) => {
    if (el.dataset.skjermtekst) return;   // allerede byttet
    el.dataset.skjermtekst = el.textContent;
    el.textContent = byggKontaktadresse(el.textContent.trim(), "epost").slice("mailto:".length);
  });
});

window.addEventListener("afterprint", () => {
  epostFelt.forEach((el) => {
    if (!el.dataset.skjermtekst) return;
    el.textContent = el.dataset.skjermtekst;
    delete el.dataset.skjermtekst;
  });
});


// ============================================================
// 2. Statuslinja
// ============================================================
//
// Hver oppføring er enten en "jobb" ({ cmd, out }) eller en enlinjer
// ({ note }), som vises som en kommentar med #. Kommandoen skrives ut tegn
// for tegn; utdata dukker opp momentant, slik en ekte terminal oppfører seg.
// Deretter holdes bildet i 3,5 sekunder før det tømmes.
//
// STATUS_FAST vises alltid først, hver gang siden lastes. Resten stokkes.
//
// Vil du legge til noe? Én linje i lista under. To regler:
//   1. Hold linjene under ~40 tegn. CSS-en reserverer to linjer, og lengre
//      tekst brekker og får resten av siden til å hoppe på mobil.
//   2. Utdata skal være sant. Dette er en CV, ikke en spøk — alt her viser
//      til noe som faktisk har skjedd.

const STATUS_FAST = {
  cmd: "uptime",
  out: "oppe siden 2010, ingen planlagt nedetid",
};

const STATUS_POOL = [
  { cmd: "systemctl status fordson-dexta", out: "active (running) siden vinteren 2025" },
  { cmd: "dmesg | tail -1",                out: "dynamo: ingen ladestrøm" },
  { cmd: "du -sh gård/",                   out: "340 mål" },
  { cmd: "echo $PATH",                     out: "/gård:/anlegg:/verksted:/kode" },
  { cmd: "tail /var/log/vedklyver",        out: "pakninger byttet. tett." },
  { cmd: "make",                           out: "ferdig. den går." },
  { note: "nytt ledningsnett, original lakk" },
];

const cmdEl = document.getElementById("status-cmd");
const outEl = document.getElementById("status-out");

const onskerRedusertBevegelse = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// En liten hjelper: "vent så mange millisekunder". Gjør at resten kan
// skrives ovenfra og ned med await, i stedet for setTimeout inni
// setTimeout inni setTimeout.
const vent = (ms) => new Promise((klar) => setTimeout(klar, ms));

// --- Stokking ---------------------------------------------------
// Ikke trekk tilfeldig hver gang — da kommer samme linje rett etter
// seg selv støtt. Stokk hele bunken (Fisher–Yates), gå gjennom den,
// og stokk på nytt når den er tom. Da får du hver oppføring én gang
// per runde, i tilfeldig rekkefølge.

function stokk(liste) {
  const kopi = liste.slice();
  for (let i = kopi.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kopi[i], kopi[j]] = [kopi[j], kopi[i]];
  }
  return kopi;
}

let ko = [];
let forrige = null;

function nesteOppforing() {
  if (ko.length === 0) {
    ko = stokk(STATUS_POOL);
    // Eneste svakheten med stokking: den siste i én runde kan bli den
    // første i neste. Bytt om på de to første hvis det skjer.
    if (ko.length > 1 && ko[0] === forrige) {
      [ko[0], ko[1]] = [ko[1], ko[0]];
    }
  }
  forrige = ko.shift();
  return forrige;
}

// Står fanen i bakgrunnen, er det ingen vits i å skrive ut tekst ingen
// ser. Vi venter til den er synlig igjen.
function ventTilSynlig() {
  if (!document.hidden) return Promise.resolve();
  return new Promise((klar) => {
    const lytt = () => {
      if (!document.hidden) {
        document.removeEventListener("visibilitychange", lytt);
        klar();
      }
    };
    document.addEventListener("visibilitychange", lytt);
  });
}

async function visOppforing(oppforing) {
  const tekst = oppforing.note ? "# " + oppforing.note : oppforing.cmd;

  cmdEl.textContent = "";
  outEl.textContent = "";

  for (let i = 1; i <= tekst.length; i++) {
    cmdEl.textContent = tekst.slice(0, i);
    await vent(45);
  }

  if (oppforing.out) {
    await vent(180);            // kort pause, som å trykke enter
    outEl.textContent = oppforing.out;   // ... og så alt på én gang
  }

  await vent(3500);             // hold på det ferdige bildet
}

async function kjorStatuslinje() {
  // Første oppføring er fast, så siden alltid åpner likt.
  let oppforing = STATUS_FAST;

  for (;;) {
    await ventTilSynlig();
    await visOppforing(oppforing);
    cmdEl.textContent = "";
    outEl.textContent = "";
    await vent(400);
    oppforing = nesteOppforing();
  }
}

if (cmdEl && outEl && !onskerRedusertBevegelse) {
  kjorStatuslinje();
}
// Ved redusert bevegelse og ved utskrift skjuler CSS-en hele den
// animerte linja og viser .tagline-static i stedet. Derfor trengs
// ingen aria-live her: skjermlesere får én fast setning som ikke
// endrer seg, og PDF-en kan aldri få med en halvskrevet kommando.


// ============================================================
// 3. Loggen glir inn når du scroller til den
// ============================================================

const logEntries = document.querySelectorAll(".log-entry");

function visAlleLoggoppforinger() {
  logEntries.forEach((entry) => entry.classList.add("is-visible"));
}

if (logEntries.length && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target); // bare animer én gang
        }
      });
    },
    { threshold: 0.15 }
  );

  logEntries.forEach((entry) => observer.observe(entry));
} else {
  visAlleLoggoppforinger();
}

// Utskrift: oppføringene starter usynlige (opacity: 0) og blir synlige
// først når man scroller forbi dem. Trykker du Ctrl+P uten å ha
// scrollet, ville loggen blitt blank på papiret. CSS-en fikser dette,
// men vi gjør det her også — belte og bukseseler, fordi nettlesere
// håndterer utskriftstidspunktet ulikt.
window.addEventListener("beforeprint", visAlleLoggoppforinger);
