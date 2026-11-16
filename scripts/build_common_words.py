"""Builds word_files/common_words.txt: the words a single-solution puzzle may use as its answer.

words.txt is every word the game ACCEPTS (and what uniqueness is checked against). This list is a
stricter subset for ANSWERS: everyday words with no argument about obscurity, and nothing offensive,
profane, sexual or grim. Reviewed by hand on 2026-11-15. Left out on purpose:
  - obscure or literary words (adage, ennui, scion), and science/jargon (aorta, lymph, xylem)
  - anything crude, sexual, insulting or a slur, even if mild
  - proper nouns and capitalized words (april, bible, dutch, china)
  - British spellings and forms (lorry, leant, spelt)
  - regular past tenses that slipped into words.txt (fried, loved, plied) and odd comparatives (purer, saner)
  - informal or slangy words (bloke, homie, gyatt)
  - grim words for a cheerful daily game (abuse, tumor, vomit)

To change it, edit EXCLUDE and run from the repo root:  python3 scripts/build_common_words.py
"""
EXCLUDE = """
aback abase abate abbot abhor abled abode abuzz achoo acrid adage aegis affix afire afoot afoul agape agate aglet aglow aider aioli
allay allot aloft aloof amass amble amino amiss amity amply angst annex annul anode antic aorta aphid apian aping apnea april aptly
arbor ardor arepa ascot ashen askew assay atoll atone augur aunty avail avert avian awash axial axiom axion azure
baler balmy banal basal baste batty bawdy bayou beady beech befit begat beget belie belle bendy berth beset betel bevel bezel bible
biddy bigot bilge billy biome biped bitch bitty blare bleat bleep bling bloke bluer blurb bobby boner boney bongo booby booty booze
boozy borax borne boron bosom botch bough boule bowel brail brash brawn briar brine briny broil brood brunt burka burly burqa bused
butch butte buxom bylaw
cabal cabby cacao cache cagey cairn canny canon caper caput carat caret caste catty caulk cavil chafe chaff chard chide china chive
chock chode chuck chump cinch circa clack clang clank cleat cleft clink clomp clout clove cluck clued cocky conch conic copse corer
coupe couth coven covet covey cower coyly crass credo creed creme cress crick crier crimp crock crone crony croon croup cruet crump
cumin curio cynic
dally dandy datum daunt debar decry defer deign deity delve demur derby deter deuce dicey dildo dilly dingo dingy diode dirge ditty
dodgy dogma dolly dopey dowdy dowel downy dowry drake drawl drier droid droit droll dross druid dryad dryly duchy ducky dully dumpy
dunce dusky dutch duvet dwarf dwelt
eater ebony eclat edict edify egret eking elate elegy elfin elide elope elude emcee emote enact endow enema ennui ensue envoy epoch
epoxy erect ester ether ethic ethos etude evoke exalt exeat exert extol exult eying
facet fanny farce farro fatty fauna fecal feign fella felon femme femur feral fetal fetid fetus ficus fiend filer filet filly filmy
filth fixer fjord flack flail flank fleck flier flora flout flume focal foist folio folly foray forgo forte frack freer friar frill
frisk fritz frock frond fugue fungi furor
gaffe gaily gamey gamma gamut gaudy gaunt gavel gawky gayer gayly gazer ghast gipsy girly girth glade gland glean glyph gnash godly
golem golly gonad goner goody gouge graft grail gripe groin grope grout gruel guile guise gulag gulch gully gumbo gusto gusty gyatt
gyoza gypsy
harem harpy harry hater haute heady heath helix hence hippy homer homie horny hotly hovel hubby humph humus hunky hussy hutch hydro
hymen
icily idiom idiot idler idyll iftar iliac imbue impel inane incur inept inert infer ingot inlay inlet inset inter ionic irate islet
jammy jaunt jetty jiffy jimmy joist joust junta junto
kappa kebab kefir kinky knave kneed knoll kooky krill
laden lager laggy lance lapel latex lathe layup leach leant leery leggy leper libel liege liken lipid lithe loamy loath locus lorry
loser louse lover lowly lucid lumen lupus lurch lurid lusty lymph lynch
macaw macho madam mafia maize mambo mamma mammy manga mange mangy mania manic manly mason masse matey matte mauve maxim mealy means
mecca melee mezze midge midst mince minim mirth miser missy modal modem mogul moron morph motif moult mourn mucky mucus mulch musky
myrrh
nadir natal naval nexus ninny nobly nomad noose nosey nymph
oaken obese octal octet odder offal olden ombre omega onery onset opine opium optic orate outdo outgo ovary ovate overt ovine ovoid
owing oxide
pacer paddy pagan pager paler palsy pansy panty papal parch parer parry parse pasty patsy payee payer penal pence penis penne peony
peril piety piney pinto pious piper pique piste pithy plait pleat plied plier plumb plume plunk pluot poesy polio polyp poopy poser
posit posse prawn preen prick pricy pried primo primp privy prong prose prude psalm psych pubic pudgy pulpy purer pygmy
qualm quark quash quasi queef queer quell queso quoth
rabbi radii rager rajah ralph randy rarer ratty rayon razed rearm rebar rebus rebut recur recut reedy refit remit renal retch revel
revue rigor riper riser roger rouge rouse rower ruddy ruder rumba rupee
sally salve salvo samba saner satyr saute savoy scald scamp scant scion scram scree scrum seedy segue semen sepia serif shale shalt
shank shart sheik shied shire shirk shoal shorn shrew shuck shunt shyly sigma sinew singe sissy skiff skimp skulk slain slink sloop
slosh slung slunk slyly smelt smite smith smock smote snaky snide snipe snuff sooth sooty sower spank spasm spelt sperm spied spiel
spilt spire spork sprig spunk spurn spurt squib staid stave stead steed stein stilt stint stoic stoke stout strep strew strop stunk
suave suing sulky sully sumac surer surly swain swami swash swath swear swill swine swoon swore sworn synod
tabby taboo tacit taint taker tamer taper tapir tarot taser tater tatty taupe tawny tenet tepee tepid terra terse testy theta thong
throb thrum tibia tilde tipsy titan tithe toddy tonal toner tonga tonic torte torus totem toxin tract tramp trawl triad trice trill
tripe trite trope trove truer trump truss tryst tubal tuber tulle tuner tunic twang tweed twerk twixt
udder ulcer umbra unbar unbox uncap uncut undid undue unfed unfit unhip unlit unmet unset unwed urine usurp utile
valor vapid vaunt veiny verge verso verve vicar vigil vigor viola vixen vodka vogue voila vomit vouch vying
wager waive warty waver waxen weedy welch welsh wetly wharf whelp whiff whore wight willy wimpy winch wispy woken woody wooer wooly
woozy wrack wreak wrest wring wrung wryly
xylem zilch zonal
freed fried dried cried tried loved mixed coded bored tired wired
screw abuse tumor adept adorn alloy
"""
exclude = set(EXCLUDE.split())
words = [w.strip() for w in open('word_files/words.txt') if w.strip()]
unknown = sorted(exclude - set(words))
if unknown:
    raise SystemExit(f"excluded words not in words.txt: {unknown}")
common = sorted(set(words) - exclude)
open('word_files/common_words.txt', 'w').write('\n'.join(common) + '\n')
print(f"{len(set(words))} unique words in words.txt (one duplicate: {[w for w in set(words) if words.count(w) > 1]})")
print(f"excluded {len(exclude)}, kept {len(common)}")
