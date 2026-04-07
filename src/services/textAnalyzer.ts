import type { ParsedDocument } from './documentParser';

// --- UNREADABLE CONTENT DETECTION ---

export interface UnreadableItem {
  id: string;
  documentId: string;
  documentName: string;
  section: string;
  issue: string;
  context: string;
  status: 'pending' | 'resolved' | 'ignored';
  resolution?: string;
}

export function detectUnreadable(docs: ParsedDocument[]): UnreadableItem[] {
  const items: UnreadableItem[] = [];
  let counter = 0;

  for (const doc of docs) {
    doc.pages.forEach((page, pageIdx) => {
      const lines = page.split(/\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Garbled/corrupt text: high ratio of non-alphanumeric characters
        const alphaCount = (trimmed.match(/[a-zA-Z0-9\s]/g) || []).length;
        if (trimmed.length > 10 && alphaCount / trimmed.length < 0.5) {
          counter++;
          items.push({
            id: `ur-${counter}`,
            documentId: doc.id,
            documentName: doc.name,
            section: `Page ${pageIdx + 1}`,
            issue: 'Garbled or unreadable text detected',
            context: trimmed.slice(0, 200),
            status: 'pending',
          });
        }

        // OCR-style errors: lots of isolated single characters
        const words = trimmed.split(/\s+/);
        const singleCharWords = words.filter(w => w.length === 1 && !/[aAiI\d]/.test(w));
        if (words.length > 5 && singleCharWords.length / words.length > 0.3) {
          counter++;
          items.push({
            id: `ur-${counter}`,
            documentId: doc.id,
            documentName: doc.name,
            section: `Page ${pageIdx + 1}`,
            issue: 'Possible OCR errors — many isolated characters',
            context: trimmed.slice(0, 200),
            status: 'pending',
          });
        }

        // Table/image references without content
        if (/\b(table|figure|diagram|image|chart)\s*\d*/i.test(trimmed) &&
            trimmed.length < 40 &&
            !/[:.]/.test(trimmed)) {
          counter++;
          items.push({
            id: `ur-${counter}`,
            documentId: doc.id,
            documentName: doc.name,
            section: `Page ${pageIdx + 1}`,
            issue: 'Reference to visual element — content may not be captured',
            context: trimmed,
            status: 'pending',
          });
        }
      }

      // Extremely short page that's likely incomplete
      if (page.trim().length > 0 && page.trim().length < 20) {
        counter++;
        items.push({
          id: `ur-${counter}`,
          documentId: doc.id,
          documentName: doc.name,
          section: `Page ${pageIdx + 1}`,
          issue: 'Very short page content — may be an incomplete extraction',
          context: page.trim(),
          status: 'pending',
        });
      }
    });
  }

  return items;
}

// --- TERMINOLOGY / FIND-AND-REPLACE SEARCH ---

export interface TermMatch {
  docId: string;
  docName: string;
  pageIndex: number;
  charOffset: number;
  surroundingText: string;
  matchedText: string;
}

export function searchTermAcrossDocs(docs: ParsedDocument[], query: string): TermMatch[] {
  if (!query.trim()) return [];
  const matches: TermMatch[] = [];
  const lowerQuery = query.toLowerCase();

  for (const doc of docs) {
    doc.pages.forEach((page, pageIdx) => {
      const lowerPage = page.toLowerCase();
      let startPos = 0;

      while (true) {
        const idx = lowerPage.indexOf(lowerQuery, startPos);
        if (idx === -1) break;

        const contextStart = Math.max(0, idx - 80);
        const contextEnd = Math.min(page.length, idx + query.length + 80);
        const prefix = contextStart > 0 ? '...' : '';
        const suffix = contextEnd < page.length ? '...' : '';

        matches.push({
          docId: doc.id,
          docName: doc.name,
          pageIndex: pageIdx,
          charOffset: idx,
          surroundingText: prefix + page.slice(contextStart, contextEnd) + suffix,
          matchedText: page.slice(idx, idx + query.length),
        });

        startPos = idx + 1;
      }
    });
  }

  return matches;
}

// --- NON-ENGLISH / UNDEFINED TERM DETECTION ---

export interface UndefinedTerm {
  id: string;
  term: string;
  displayForm: string;
  occurrences: number;
  sampleContext: string;
  sourceDocNames: string[];
  definition: string;
  status: 'pending' | 'defined' | 'ignored';
}

// ~3000 most common English words (lowercased). Any word NOT here AND longer
// than 3 chars gets flagged as a potential undefined/domain-specific term.
// This is a curated subset covering everyday vocabulary, common verbs,
// adjectives, pronouns, prepositions, conjunctions, and business terms.
const COMMON_ENGLISH = new Set([
  'the','be','to','of','and','a','in','that','have','i','it','for','not','on',
  'with','he','as','you','do','at','this','but','his','by','from','they','we',
  'say','her','she','or','an','will','my','one','all','would','there','their',
  'what','so','up','out','if','about','who','get','which','go','me','when',
  'make','can','like','time','no','just','him','know','take','people','into',
  'year','your','good','some','could','them','see','other','than','then','now',
  'look','only','come','its','over','think','also','back','after','use','two',
  'how','our','work','first','well','way','even','new','want','because','any',
  'these','give','day','most','us','great','between','need','large','often',
  'each','before','through','change','long','much','right','where','own','still',
  'found','here','thing','many','those','tell','very','hand','high','keep',
  'place','same','while','last','might','old','think','being','another',
  'point','next','different','home','ask','turn','move','live','find','around',
  'should','under','close','end','show','side','every','again','does','help',
  'line','never','small','part','number','too','off','start','run','read',
  'word','head','call','open','set','house','state','world','left','put',
  'school','city','still','case','may','such','lot','try','against','feel',
  'three','really','look','must','big','group','begin','seem','country','child',
  'area','since','always','last','let','thought','both','add','few','follow',
  'got','own','life','without','went','still','already','become','might','best',
  'more','less','did','more','will','new','full','system','below','above',
  'note','please','refer','thank','information','contact','details','number',
  'amount','total','account','service','customer','bank','card','payment',
  'transfer','transaction','balance','fee','charge','rate','interest','loan',
  'deposit','withdrawal','savings','credit','debit','mobile','online','digital',
  'application','process','request','submit','verify','update','check','review',
  'confirm','cancel','block','enable','disable','access','login','password',
  'security','support','issue','problem','error','question','answer','yes',
  'sure','please','available','required','minimum','maximum','limit','period',
  'business','personal','individual','corporate','domestic','international',
  'daily','monthly','annual','free','valid','active','inactive','pending',
  'approved','rejected','failed','success','complete','incomplete','status',
  'type','name','date','email','phone','address','country','city','province',
  'region','branch','office','center','agent','manager','officer','staff',
  'member','user','client','partner','company','organization','network','data',
  'file','document','page','form','report','record','list','table','field',
  'value','option','feature','function','setting','policy','rule','condition',
  'step','level','stage','version','standard','format','code','text','message',
  'notification','alert','warning','guide','manual','instruction','procedure',
  'agreement','terms','conditions','requirements','qualification','eligibility',
  'registration','activation','verification','authentication','authorization',
  'identification','enrollment','subscription','plan','package','offer','promo',
  'discount','benefit','reward','bonus','program','campaign','event','schedule',
  'calendar','time','hour','minute','second','week','month','quarter','year',
  'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
  'january','february','march','april','june','july','august','september',
  'october','november','december','shall','must','may','can','could','should',
  'would','will','might','need','want','wish','hope','expect','allow','permit',
  'require','include','exclude','provide','receive','send','deliver','return',
  'accept','decline','approve','deny','grant','refuse','select','choose','pick',
  'enter','exit','continue','stop','pause','wait','proceed','advance','forward',
  'backward','previous','current','existing','remain','stay','keep','hold',
  'maintain','manage','handle','operate','perform','execute','implement','apply',
  'follow','comply','adhere','meet','satisfy','fulfill','resolve','address',
  'respond','reply','acknowledge','notify','inform','advise','recommend','suggest',
  'propose','request','inquire','ask','answer','explain','describe','define',
  'identify','classify','categorize','organize','arrange','sort','filter',
  'search','find','locate','track','monitor','measure','evaluate','assess',
  'analyze','compare','contrast','test','examine','inspect','audit','verify',
  'validate','confirm','ensure','guarantee','protect','secure','prevent','avoid',
  'reduce','minimize','eliminate','remove','delete','clear','reset','restore',
  'recover','backup','save','store','retrieve','download','upload','install',
  'uninstall','launch','release','deploy','publish','share','distribute','copy',
  'move','rename','edit','modify','adjust','customize','configure','setup',
  'create','build','develop','design','plan','prepare','draft','write','compose',
  'generate','produce','manufacture','assemble','connect','disconnect','link',
  'attach','detach','join','separate','split','merge','combine','integrate',
  'using','used','able','unable','upon','within','within','along','across',
  'among','during','until','unless','whether','however','therefore','moreover',
  'furthermore','although','though','whereas','meanwhile','otherwise','instead',
  'thereby','thus','hence','accordingly','consequently','subsequently','previously',
  'simultaneously','immediately','eventually','finally','initially','originally',
  'currently','recently','frequently','occasionally','typically','generally',
  'usually','normally','regularly','specifically','particularly','especially',
  'exactly','approximately','nearly','almost','quite','rather','fairly','pretty',
  'somewhat','slightly','highly','extremely','absolutely','completely','entirely',
  'fully','totally','partially','mostly','largely','mainly','primarily','solely',
  'merely','simply','directly','indirectly','automatically','manually','respective',
  'various','several','multiple','numerous','additional','extra','further','specific',
  'particular','certain','relevant','appropriate','suitable','proper','correct',
  'accurate','precise','exact','actual','real','true','false','valid','invalid',
  'possible','impossible','necessary','unnecessary','important','significant',
  'essential','critical','vital','key','main','major','minor','primary','secondary',
  'basic','advanced','simple','complex','easy','difficult','hard','soft','fast',
  'slow','quick','early','late','soon','recent','past','present','future',
  'temporary','permanent','fixed','variable','constant','regular','irregular',
  'normal','abnormal','positive','negative','neutral','single','double','triple',
  'once','twice','half','quarter','third','fourth','fifth','sixth','seventh',
  'eighth','ninth','tenth','hundred','thousand','million','billion','zero',
  'four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen',
  'fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty',
  'thirty','forty','fifty','sixty','seventy','eighty','ninety','been','being',
  'done','going','having','making','getting','taking','coming','seeing','knowing',
  'giving','using','finding','telling','working','calling','trying','leaving',
  'putting','meaning','letting','beginning','seeming','helping','showing','hearing',
  'playing','running','moving','living','believing','bringing','happening','writing',
  'providing','sitting','standing','losing','paying','meeting','including','continuing',
  'learning','changing','leading','understanding','watching','following','stopping',
  'speaking','reading','spending','growing','opening','walking','winning','teaching',
  'offering','remembering','considering','appearing','buying','serving','dying',
  'sending','building','staying','falling','cutting','reaching','killing','raising',
  'passing','selling','deciding','returning','explaining','hoping','developing',
  'carrying','breaking','receiving','agreeing','supporting','holding','turning',
  'producing','eating','dealing','setting','looking','acting','waiting','planning',
  'starting','wondering','pulling','pressing','picking','filling','pointing',
  'forming','sitting','posting','closing','calling','sharing','replying','stating',
  'per','via','non','pre','post','sub','anti','multi','inter','super','auto','self',
  'like','unlike','based','related','given','according','regarding','concerning',
  'involving','depending','resulting','leading','including','excluding','following',
  'corresponding','associated','connected','linked','attached','compared','opposed',
  'able','ible','tion','ment','ness','ity','ous','ful','ive','less','ent','ant',
  'not','also','than','such','when','what','which','where','while','after','before',
  'here','there','then','now','just','only','even','still','already','yet','ever',
  'never','always','often','sometimes','usually','generally','probably','possibly',
  'certainly','definitely','obviously','clearly','apparently','reportedly','allegedly',
  'supposedly','presumably','hopefully','unfortunately','fortunately','interestingly',
  'surprisingly','importantly','significantly','additionally','alternatively','consequently',
  'nevertheless','nonetheless','regardless','meanwhile','furthermore','however','moreover',
  'therefore','otherwise','instead','indeed','fact','example','instance','case','order',
  'addition','comparison','contrast','result','response','regard','terms','spite',
  'behalf','means','general','practice','theory','principle','basis','ground',
  'together','apart','away','down','off','back','again','out','over','up','through',
  'peso','pesos','php','usd','dollar','dollars','cent','cents','money','cash',
  'fund','funds','invest','investment','insurance','coverage','premium','claim',
  'bill','billing','invoice','receipt','voucher','coupon','ticket','token',
  'device','devices','phone','tablet','computer','laptop','desktop','browser',
  'app','apps','website','web','site','page','screen','window','tab','menu',
  'button','icon','link','click','tap','swipe','scroll','type','press','enter',
  'select','drag','drop','hover','touch','scan','capture','photo','image',
  'video','audio','media','camera','microphone','speaker','display','keyboard',
  'mouse','printer','scanner','hardware','software','firmware','operating',
  'android','windows','linux','mac','ios','chrome','safari','firefox','edge',
  'google','apple','microsoft','facebook','amazon','twitter',
  'biometrics','biometric','fingerprint','facial','recognition',
  'qr','sms','otp','pin','atm','sim','nfc','gps','wifi','bluetooth',
  'api','sdk','url','http','https','ssl','tls','vpn','dns','ip',
  'faq','faqs','pdf','doc','docx','txt','csv','xml','json','html',
  'ceo','cfo','cto','coo','vp','svp','evp','md','avp','mgr',
  'inc','ltd','llc','plc','corp','co',
  'id','ids','ref','no','nos','sr','jr','mr','mrs','ms','dr','prof',
  'etc','vs','ie','eg',
]);

function isNonEnglishWord(word: string): boolean {
  const clean = word.replace(/^[#@]+/, '').replace(/[''`]/g, '');
  if (clean.length < 3) return false;
  if (/^\d+$/.test(clean)) return false;
  if (/^https?:\/\//i.test(word)) return false;

  // Immediately flag #-prefixed product names
  if (word.startsWith('#') && clean.length > 3) return true;

  const lower = clean.toLowerCase();

  // Skip if it's a common English word
  if (COMMON_ENGLISH.has(lower)) return false;

  // ALL-CAPS words (3+ letters) that aren't in the dictionary → likely acronyms/brands
  if (/^[A-Z]{3,}$/.test(clean)) return true;

  // CamelCase / mixed case: PESONet, InstaPay, ExoPhone, UNOready
  if (/[a-z][A-Z]/.test(clean) || /[A-Z]{2,}[a-z]/.test(clean)) return true;

  // Digits mixed with letters: PHP100, 3G, 2FA
  if (/[a-zA-Z]/.test(clean) && /\d/.test(clean)) return true;

  // Words with unusual letter patterns (no vowels, triple consonants, etc.)
  if (clean.length >= 4 && !/[aeiou]/i.test(clean)) return true;

  // Title-cased words that look like proper nouns / brand names not in dictionary
  if (/^[A-Z][a-z]{2,}$/.test(clean) && !COMMON_ENGLISH.has(lower)) {
    // Only flag if it doesn't look like a standard capitalized English word
    // Check if the lowercase version has common English word patterns
    if (!looksLikeEnglish(lower)) return true;
  }

  // Entirely uppercase short form not in dictionary
  if (/^[A-Z]+$/.test(clean) && clean.length >= 2 && !COMMON_ENGLISH.has(lower)) return true;

  // General catch-all: if the lowercase form is not in our dictionary and >= 4 chars,
  // check if it passes a basic phonetic plausibility test
  if (clean.length >= 4 && !COMMON_ENGLISH.has(lower) && !looksLikeEnglish(lower)) {
    return true;
  }

  return false;
}

function looksLikeEnglish(lower: string): boolean {
  // Common English word endings
  const englishSuffixes = [
    'ing','tion','sion','ment','ness','ity','ous','ful','ive','less','ent',
    'ant','ible','able','ence','ance','ally','ical','ular','ated','ting',
    'ized','ised','ling','ship','ward','wise','like','ness','ence','ance',
    'dom','ism','ist','ual','ive','ory','ary','ery',
    'ed','er','es','ly','al','en','ty',
  ];
  if (englishSuffixes.some(s => lower.endsWith(s) && lower.length > s.length + 2)) return true;

  // Common English prefixes
  const englishPrefixes = [
    'un','re','in','dis','en','non','pre','mis','over','under','out','sub',
    'super','inter','trans','anti','auto','counter','multi',
  ];
  if (englishPrefixes.some(p => lower.startsWith(p) && lower.length > p.length + 2)) {
    const remainder = lower.slice(lower.startsWith('counter') ? 7 : lower.startsWith('super') || lower.startsWith('under') || lower.startsWith('inter') || lower.startsWith('trans') || lower.startsWith('multi') ? 5 : lower.startsWith('over') || lower.startsWith('anti') || lower.startsWith('auto') || lower.startsWith('non') ? (lower.startsWith('non') ? 3 : 4) : lower.startsWith('dis') || lower.startsWith('mis') || lower.startsWith('out') || lower.startsWith('sub') || lower.startsWith('pre') ? 3 : 2);
    if (COMMON_ENGLISH.has(remainder)) return true;
  }

  // Check consonant/vowel pattern - English words alternate reasonably
  const vowels = (lower.match(/[aeiou]/g) || []).length;
  const ratio = vowels / lower.length;
  if (ratio < 0.15 || ratio > 0.8) return false;

  return false;
}

export function detectUndefinedTerms(docs: ParsedDocument[]): UndefinedTerm[] {
  const termMap = new Map<string, { displayForm: string; count: number; contexts: string[]; docNames: Set<string> }>();

  for (const doc of docs) {
    const words = doc.text.match(/[#@]?\w[\w'-]*\w|\w{3,}/g) || [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!isNonEnglishWord(word)) continue;

      const clean = word.replace(/^[#@]+/, '');
      const key = clean.toLowerCase();
      if (key.length < 3) continue;

      const entry = termMap.get(key) || { displayForm: clean, count: 0, contexts: [], docNames: new Set() };
      entry.count++;
      entry.docNames.add(doc.name);
      // Keep the most "interesting" display form (preserve original casing from first occurrence)
      if (entry.count === 1) entry.displayForm = clean;

      if (entry.contexts.length < 3) {
        const searchFrom = Math.max(0, doc.text.indexOf(words[Math.max(0, i - 3)] || '', 0));
        const idx = doc.text.indexOf(word, searchFrom);
        if (idx >= 0) {
          const ctxStart = Math.max(0, idx - 60);
          const ctxEnd = Math.min(doc.text.length, idx + word.length + 60);
          const prefix = ctxStart > 0 ? '...' : '';
          const suffix = ctxEnd < doc.text.length ? '...' : '';
          entry.contexts.push(prefix + doc.text.slice(ctxStart, ctxEnd).replace(/\s+/g, ' ') + suffix);
        }
      }

      termMap.set(key, entry);
    }
  }

  // Check which terms are defined in the document text
  const definedInDoc = new Set<string>();
  const fullText = docs.map(d => d.text).join(' ').toLowerCase();

  for (const [key] of termMap) {
    const defPatterns = [
      new RegExp(`\\b${escapeRegexStr(key)}\\b\\s+(?:is|are|means?|refers?\\s+to|stands?\\s+for|—|-)\\s+`, 'i'),
      new RegExp(`\\b(?:called|known\\s+as|referred\\s+to\\s+as)\\s+${escapeRegexStr(key)}\\b`, 'i'),
    ];
    if (defPatterns.some(p => p.test(fullText))) {
      definedInDoc.add(key);
    }
  }

  const terms: UndefinedTerm[] = [];
  let counter = 0;

  for (const [key, data] of termMap) {
    counter++;
    terms.push({
      id: `udt-${counter}`,
      term: key,
      displayForm: data.displayForm,
      occurrences: data.count,
      sampleContext: data.contexts[0] || '',
      sourceDocNames: Array.from(data.docNames),
      definition: '',
      status: definedInDoc.has(key) ? 'ignored' : 'pending',
    });
  }

  terms.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return b.occurrences - a.occurrences;
  });

  return terms;
}

function escapeRegexStr(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- CONFLICT DETECTION ---

export interface ConflictItem {
  id: string;
  type: 'internal' | 'cross-document';
  topic: string;
  valueA: string;
  valueB: string;
  sourceA: string;
  sourceB: string;
  pageA: number | null;
  pageB: number | null;
  contextA: string;
  contextB: string;
  resolution: 'keepA' | 'keepB' | 'custom' | null;
  customResolution?: string;
}

function findPageForText(doc: ParsedDocument, text: string): number | null {
  const snippet = text.slice(0, 80).toLowerCase();
  for (let i = 0; i < doc.pages.length; i++) {
    if (doc.pages[i].toLowerCase().includes(snippet)) return i + 1;
  }
  return null;
}

export function detectConflicts(docs: ParsedDocument[]): ConflictItem[] {
  const conflicts: ConflictItem[] = [];
  let counter = 0;

  const docMap = new Map<string, ParsedDocument>();
  for (const doc of docs) docMap.set(doc.id, doc);

  const qaByDoc: Map<string, { question: string; answer: string; docId: string; docName: string; page: number | null }[]> = new Map();

  for (const doc of docs) {
    const extracted = extractQAPairsForConflictsWithPage(doc);
    qaByDoc.set(doc.id, extracted);
  }

  // Internal conflicts: same doc, similar question, different answer
  for (const [, pairs] of qaByDoc) {
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const sim = textSimilarity(pairs[i].question, pairs[j].question);
        if (sim > 0.7 && textSimilarity(pairs[i].answer, pairs[j].answer) < 0.8) {
          counter++;
          conflicts.push({
            id: `cf-${counter}`,
            type: 'internal',
            topic: pairs[i].question.slice(0, 100),
            valueA: pairs[i].answer.slice(0, 300),
            valueB: pairs[j].answer.slice(0, 300),
            sourceA: pairs[i].docName,
            sourceB: pairs[i].docName,
            pageA: pairs[i].page,
            pageB: pairs[j].page,
            contextA: pairs[i].answer,
            contextB: pairs[j].answer,
            resolution: null,
          });
        }
      }
    }
  }

  // Cross-document conflicts: different docs, similar question, different answer
  const docIds = Array.from(qaByDoc.keys());
  for (let d1 = 0; d1 < docIds.length; d1++) {
    for (let d2 = d1 + 1; d2 < docIds.length; d2++) {
      const pairs1 = qaByDoc.get(docIds[d1]) || [];
      const pairs2 = qaByDoc.get(docIds[d2]) || [];

      for (const p1 of pairs1) {
        for (const p2 of pairs2) {
          const sim = textSimilarity(p1.question, p2.question);
          if (sim > 0.6 && textSimilarity(p1.answer, p2.answer) < 0.8) {
            counter++;
            conflicts.push({
              id: `cf-${counter}`,
              type: 'cross-document',
              topic: p1.question.slice(0, 100),
              valueA: p1.answer.slice(0, 300),
              valueB: p2.answer.slice(0, 300),
              sourceA: p1.docName,
              sourceB: p2.docName,
              pageA: p1.page,
              pageB: p2.page,
              contextA: p1.answer,
              contextB: p2.answer,
              resolution: null,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

function extractQAPairsForConflictsWithPage(doc: ParsedDocument): { question: string; answer: string; docId: string; docName: string; page: number | null }[] {
  const pairs: { question: string; answer: string; docId: string; docName: string; page: number | null }[] = [];
  const blocks = doc.text.split(/(?=(?:QUESTION|Question)\s*[:.]?\s)/i);
  for (const block of blocks) {
    const m = block.match(/(?:QUESTION|Question)\s*[:.]?\s*([\s\S]*?)(?:ANSWER|Answer)\s*[:.]?\s*([\s\S]*)/i);
    if (m) {
      const q = m[1].trim().replace(/\s+/g, ' ').replace(/-- \d+ of \d+ --/g, '').trim();
      const a = m[2].trim().replace(/\s+/g, ' ').replace(/-- \d+ of \d+ --/g, '').trim();
      if (q && a) {
        pairs.push({
          question: q.slice(0, 200),
          answer: a.slice(0, 500),
          docId: doc.id,
          docName: doc.name,
          page: findPageForText(doc, q),
        });
      }
    }
  }
  return pairs;
}

function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  return (2 * intersection) / (wordsA.size + wordsB.size);
}

// --- FAQ GENERATION ---

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  sourceDoc: string;
  category: 'extracted' | 'generated';
  status: 'pending' | 'accepted' | 'edited' | 'deleted';
}

export function generateFAQs(docs: ParsedDocument[]): FAQItem[] {
  const faqs: FAQItem[] = [];
  let counter = 0;

  for (const doc of docs) {
    // Strategy 1: Split on QUESTION/ANSWER keywords (works for both newline-separated and continuous text)
    const qaPairs = extractQAPairs(doc.text);

    for (const pair of qaPairs) {
      if (pair.question.length > 10 && pair.answer.length > 10) {
        counter++;
        faqs.push({
          id: `faq-${counter}`,
          question: pair.question,
          answer: pair.answer.slice(0, 1000),
          sourceDoc: doc.name,
          category: 'extracted',
          status: 'pending',
        });
      }
    }

    // Strategy 2: If no Q&A found, generate from content
    if (faqs.filter(f => f.sourceDoc === doc.name).length === 0) {
      const sentences = doc.text
        .split(/[.\n]+/)
        .map(s => s.trim())
        .filter(s => s.length > 30 && s.length < 500);

      const importantSentences = sentences.filter(s =>
        /\b(is|are|can|should|must|will|how|what|when|where|why)\b/i.test(s),
      );

      for (const s of importantSentences.slice(0, 20)) {
        counter++;
        const questionForm = generateQuestion(s);
        faqs.push({
          id: `faq-${counter}`,
          question: questionForm,
          answer: s,
          sourceDoc: doc.name,
          category: 'generated',
          status: 'pending',
        });
      }
    }
  }

  return deduplicateFAQs(faqs);
}

function extractQAPairs(text: string): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = [];

  // Split on QUESTION/Question keywords -- these mark the start of each Q&A block
  const blocks = text.split(/(?=(?:QUESTION|Question)\s*[:.]?\s)/i);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Try to find ANSWER in this block
    const answerMatch = trimmed.match(/(?:QUESTION|Question)\s*[:.]?\s*([\s\S]*?)(?:ANSWER|Answer)\s*[:.]?\s*([\s\S]*)/i);
    if (!answerMatch) continue;

    let question = answerMatch[1].trim().replace(/\s+/g, ' ').replace(/-- \d+ of \d+ --/g, '').trim();
    let answer = answerMatch[2].trim().replace(/\s+/g, ' ').replace(/-- \d+ of \d+ --/g, '').trim();

    // Clean up: question might include multiple variant questions separated by ?
    // Keep it as-is but trim excessive length
    if (question.length > 300) question = question.slice(0, 300);
    if (answer.length > 1500) answer = answer.slice(0, 1500);

    if (question && answer) {
      pairs.push({ question, answer });
    }
  }

  return pairs;
}

function generateQuestion(statement: string): string {
  const lower = statement.toLowerCase();
  if (lower.includes(' is ') || lower.includes(' are ')) {
    const subject = statement.split(/\bis\b|\bare\b/i)[0].trim();
    return `What ${lower.startsWith('the') || lower.startsWith('a ') ? 'is' : 'is'} ${subject}?`;
  }
  if (lower.includes(' can ')) return `Can ${statement.split(/\bcan\b/i)[1]?.trim()}?`;
  if (lower.includes(' should ')) return `Should ${statement.split(/\bshould\b/i)[1]?.trim()}?`;
  return `What does the following mean: "${statement.slice(0, 80)}"?`;
}

function deduplicateFAQs(faqs: FAQItem[]): FAQItem[] {
  const seen = new Set<string>();
  return faqs.filter(faq => {
    const key = faq.question.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- CONTENT GUIDELINE VALIDATION ---
// Based on "Content Writing Guidelines.docx" — 14 rules

export type GuidelineSeverity = 'error' | 'warning' | 'info';

export interface GuidelineViolation {
  id: string;
  guidelineNum: number;
  rule: string;
  severity: GuidelineSeverity;
  faqId: string | null;
  description: string;
  context: string;
  suggestion: string;
}

export function validateContentGuidelines(
  faqs: FAQItem[],
  docs: ParsedDocument[],
): GuidelineViolation[] {
  const violations: GuidelineViolation[] = [];
  let counter = 0;
  const activeFaqs = faqs.filter(f => f.status !== 'deleted');
  const fullText = docs.map(d => d.text).join('\n');

  // --- Rule 1: No duplicate question with different answers ---
  for (let i = 0; i < activeFaqs.length; i++) {
    for (let j = i + 1; j < activeFaqs.length; j++) {
      const qSim = textSimilarity(activeFaqs[i].question, activeFaqs[j].question);
      const aSim = textSimilarity(activeFaqs[i].answer, activeFaqs[j].answer);
      if (qSim > 0.7 && aSim < 0.8) {
        counter++;
        violations.push({
          id: `gv-${counter}`,
          guidelineNum: 1,
          rule: 'No duplicate questions with different answers',
          severity: 'error',
          faqId: activeFaqs[i].id,
          description: `This question is very similar to FAQ #${j + 1} but has a different answer.`,
          context: `Similar to: "${activeFaqs[j].question.slice(0, 80)}..."`,
          suggestion: 'Merge into a single comprehensive answer or remove the duplicate.',
        });
      }
    }
  }

  // --- Rule 2: Answer max 3 paragraphs ---
  for (const faq of activeFaqs) {
    const paragraphs = faq.answer.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 3) {
      counter++;
      violations.push({
        id: `gv-${counter}`,
        guidelineNum: 2,
        rule: 'Answer must not exceed 3 paragraphs',
        severity: 'warning',
        faqId: faq.id,
        description: `Answer has ${paragraphs.length} paragraphs (maximum is 3).`,
        context: faq.answer.slice(0, 100) + '...',
        suggestion: 'Condense the answer into 3 paragraphs or fewer while keeping it comprehensive.',
      });
    }
    // Also flag excessively long single-paragraph answers (>500 words)
    const wordCount = faq.answer.split(/\s+/).length;
    if (wordCount > 500) {
      counter++;
      violations.push({
        id: `gv-${counter}`,
        guidelineNum: 2,
        rule: 'Answer should be concise',
        severity: 'warning',
        faqId: faq.id,
        description: `Answer is ${wordCount} words long. Consider breaking into shorter, focused answers.`,
        context: '',
        suggestion: 'Split into multiple Q&A pairs or trim to essential information.',
      });
    }
  }

  // --- Rule 3: Question must be complete / standalone ---
  const incompletePatterns = [
    /^(what|how|why|when|where|which|can|is|are|do|does)\s+(about\s+)?(this|that|these|those|it)\b/i,
    /^(the\s+)?(above|below|following|previous)\b/i,
  ];
  for (const faq of activeFaqs) {
    if (incompletePatterns.some(p => p.test(faq.question.trim()))) {
      counter++;
      violations.push({
        id: `gv-${counter}`,
        guidelineNum: 3,
        rule: 'Each question must be complete and standalone',
        severity: 'warning',
        faqId: faq.id,
        description: 'Question may be incomplete — it uses vague references like "this", "that", "above".',
        context: faq.question.slice(0, 100),
        suggestion: 'Rewrite the question so it makes sense without knowing headers or context.',
      });
    }
  }

  // --- Rule 6: Q/A pairs must be self-contained (no cross-refs between pairs) ---
  const crossRefInAnswerPatterns = [
    /\b(?:see|refer(?:\s+to)?|as\s+(?:mentioned|stated|noted|explained|described)\s+(?:in|above|below|earlier|previously))\b/i,
    /\b(?:same\s+as\s+(?:above|below|before|question))\b/i,
    /\bsee\s+(?:question|q|faq|answer|a)\s*#?\d+/i,
    /\brefer\s+(?:to\s+)?(?:question|q|faq|answer|a)\s*#?\d+/i,
    /\b(?:above|below|previous)\s+(?:question|answer|section|faq)\b/i,
  ];
  for (const faq of activeFaqs) {
    const text = faq.question + ' ' + faq.answer;
    for (const pattern of crossRefInAnswerPatterns) {
      const match = text.match(pattern);
      if (match) {
        counter++;
        violations.push({
          id: `gv-${counter}`,
          guidelineNum: 6,
          rule: 'Q/A pairs must be self-contained',
          severity: 'error',
          faqId: faq.id,
          description: `Contains cross-reference: "${match[0]}". Each FAQ must stand alone.`,
          context: text.slice(Math.max(0, text.indexOf(match[0]) - 30), text.indexOf(match[0]) + match[0].length + 30),
          suggestion: 'Include the referenced information directly in this answer instead of pointing elsewhere.',
        });
        break;
      }
    }
  }

  // --- Rule 8: Jargon must be defined in brackets ---
  // Check if any detected non-English terms appear in FAQ answers without a bracket definition
  const jargonInFaqs = new Set<string>();
  for (const faq of activeFaqs) {
    const words = (faq.question + ' ' + faq.answer).match(/\b[A-Z][a-zA-Z]*[A-Z]\w*\b|\b[A-Z]{3,}\b/g) || [];
    for (const w of words) {
      const lower = w.toLowerCase();
      if (!COMMON_ENGLISH.has(lower) && w.length >= 3) {
        const hasBracketDef = new RegExp(`${escapeRegexStr(w)}\\s*\\([^)]{3,}\\)`, 'i').test(faq.answer);
        if (!hasBracketDef) {
          if (!jargonInFaqs.has(lower + ':' + faq.id)) {
            jargonInFaqs.add(lower + ':' + faq.id);
            counter++;
            violations.push({
              id: `gv-${counter}`,
              guidelineNum: 8,
              rule: 'Define jargon within brackets',
              severity: 'warning',
              faqId: faq.id,
              description: `Term "${w}" appears without a definition in brackets.`,
              context: '',
              suggestion: `Add a bracket definition, e.g., "${w} (full explanation here)".`,
            });
          }
        }
      }
    }
  }

  // --- Rule 9: Acronyms must have full form in brackets each time ---
  const acronymPattern = /\b([A-Z]{2,})\b/g;
  for (const faq of activeFaqs) {
    const text = faq.question + ' ' + faq.answer;
    const acronyms = new Set<string>();
    let m: RegExpExecArray | null;
    const re = new RegExp(acronymPattern.source, acronymPattern.flags);
    while ((m = re.exec(text)) !== null) {
      const acr = m[1];
      if (acr.length >= 2 && !COMMON_ENGLISH.has(acr.toLowerCase()) && !acronyms.has(acr)) {
        acronyms.add(acr);
        const hasBracketExpansion = new RegExp(`${escapeRegexStr(acr)}\\s*\\([^)]{3,}\\)`, 'i').test(text);
        const isBracketExpansionOf = new RegExp(`\\([^)]*${escapeRegexStr(acr)}[^)]*\\)`, 'i').test(text);
        if (!hasBracketExpansion && !isBracketExpansionOf) {
          counter++;
          violations.push({
            id: `gv-${counter}`,
            guidelineNum: 9,
            rule: 'Acronyms must include full form in brackets',
            severity: 'warning',
            faqId: faq.id,
            description: `Acronym "${acr}" is used without its full form in brackets.`,
            context: '',
            suggestion: `Write it as "${acr} (Full Form Here)" every time it's used.`,
          });
        }
      }
    }
  }

  // --- Rule 10: Remove product-specific tags (#tags) ---
  for (const faq of activeFaqs) {
    const tags = (faq.question + ' ' + faq.answer).match(/#\w{3,}/g);
    if (tags) {
      counter++;
      violations.push({
        id: `gv-${counter}`,
        guidelineNum: 10,
        rule: 'Remove product-specific tags',
        severity: 'error',
        faqId: faq.id,
        description: `Contains product-specific tag(s): ${tags.join(', ')}. These should be removed or replaced with plain language.`,
        context: '',
        suggestion: 'Replace tags with the plain product name. E.g., "#JIFFYearnCash" → "time deposit in JIFFY Bank".',
      });
    }
  }

  // --- Rule 11: No cross-references in document text ---
  const docCrossRefPatterns = [
    /\b(?:see\s+above|refer\s+below|same\s+as\s+above|as\s+above|mentioned\s+above|stated\s+below|refer\s+above)\b/gi,
  ];
  for (const faq of activeFaqs) {
    const text = faq.answer;
    for (const pattern of docCrossRefPatterns) {
      const re = new RegExp(pattern.source, pattern.flags);
      const match = re.exec(text);
      if (match) {
        counter++;
        violations.push({
          id: `gv-${counter}`,
          guidelineNum: 11,
          rule: 'Avoid cross-references like "see above" or "refer below"',
          severity: 'error',
          faqId: faq.id,
          description: `Contains cross-reference phrase: "${match[0]}".`,
          context: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
          suggestion: 'Replace with the actual content being referenced.',
        });
        break;
      }
    }
  }

  // --- Rule 12 & 13: Inconsistent terminology ---
  // Look for known synonym pairs where both are used across FAQs
  const synonymPairs = [
    ['fixed deposit', 'time deposit'],
    ['fd', 'time deposit'],
    ['savings account', 'sa'],
    ['current account', 'ca'],
    ['mobile banking', 'internet banking'],
    ['otp', 'one-time password'],
    ['one time password', 'one-time password'],
    ['e-mail', 'email'],
    ['sign in', 'log in'],
    ['signup', 'sign up'],
    ['signin', 'sign in'],
  ];
  const allFaqText = activeFaqs.map(f => (f.question + ' ' + f.answer).toLowerCase()).join(' ');
  for (const [termA, termB] of synonymPairs) {
    const hasA = allFaqText.includes(termA);
    const hasB = allFaqText.includes(termB);
    if (hasA && hasB) {
      counter++;
      violations.push({
        id: `gv-${counter}`,
        guidelineNum: 12,
        rule: 'Do not use different terms for the same thing',
        severity: 'warning',
        faqId: null,
        description: `Both "${termA}" and "${termB}" are used across FAQs. Pick one or add an FAQ explaining they mean the same thing.`,
        context: '',
        suggestion: `Use one term consistently, or add an FAQ: "What is the difference between ${termA} and ${termB}?"`,
      });
    }
  }

  // --- Rule 14: No images/screenshots (check in raw doc text) ---
  const imagePatterns = [
    /\b(?:screenshot|screen\s*shot|see\s+(?:the\s+)?image|see\s+(?:the\s+)?figure|attached\s+image|image\s+below|picture\s+(?:above|below))\b/gi,
  ];
  for (const faq of activeFaqs) {
    for (const pattern of imagePatterns) {
      const re = new RegExp(pattern.source, pattern.flags);
      const match = re.exec(faq.answer);
      if (match) {
        counter++;
        violations.push({
          id: `gv-${counter}`,
          guidelineNum: 14,
          rule: 'Do not add screenshots of text or images',
          severity: 'error',
          faqId: faq.id,
          description: `References an image/screenshot: "${match[0]}". Bot cannot process images.`,
          context: faq.answer.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
          suggestion: 'Replace the image reference with the actual text content.',
        });
        break;
      }
    }
  }

  // Sort: errors first, then warnings, then info
  const severityOrder: Record<GuidelineSeverity, number> = { error: 0, warning: 1, info: 2 };
  violations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return violations;
}

// --- DOCX EXPORT ---

export async function exportFAQsToDocx(faqs: FAQItem[]): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');

  const children: any[] = [
    new Paragraph({
      text: 'Enterprise Knowledge Base — FAQs',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated on ${new Date().toLocaleDateString()} • ${faqs.length} FAQs`,
          italics: true,
          color: '666666',
          size: 20,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
  ];

  faqs.forEach((faq, i) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Q${i + 1}: `, bold: true, size: 24 }),
          new TextRun({ text: faq.question, size: 24 }),
        ],
        spacing: { before: 300, after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'A: ', bold: true, size: 22 }),
          new TextRun({ text: faq.answer, size: 22 }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Source: ${faq.sourceDoc}`, italics: true, color: '999999', size: 18 }),
        ],
        spacing: { after: 200 },
      }),
    );
  });

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}
