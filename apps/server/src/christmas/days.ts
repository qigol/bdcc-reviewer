/**
 * Christmas countdown content, one day per number (12 on Dec 13 down to 1 on Christmas Eve).
 * Lives on the server so locked days never reach the browser. Facts were checked against sources in Nov 2026;
 * traditions are worded as traditions. Song arithmetic assumes each verse repeats every earlier gift.
 */
export interface ChristmasQuestion { id: string; prompt: string; options: string[]; answer: number; explain: string }
export interface ChristmasDay { n: number; title: string; emoji: string; lesson: string; questions: ChristmasQuestion[] }

export const DAYS: ChristmasDay[] = [
  {
    n: 12,
    title: 'The Twelve Days of Christmas',
    emoji: '🎁',
    lesson: `The **Twelve Days of Christmas** don't count down *to* Christmas. They start on it: December 25 through January 5, the eve of the Epiphany (January 6).

The song about them was first printed in a London children's book, *Mirth Without Mischief*, around **1780**. Since every verse repeats all the earlier gifts, the true love sends **364** gifts in all, one for nearly every day of the year.

You may have heard that the song is a secret code for teaching the Catholic catechism. That's a **myth**: it was first proposed in 1979 with no evidence, and nothing in the gifts would have been uniquely Catholic anyway.`,
    questions: [
      { id: 'd12-q1', prompt: 'When do the Twelve Days of Christmas actually fall?', options: ['December 13 to 24', 'December 25 to January 5', 'December 1 to 12', 'January 6 to 17'], answer: 1, explain: 'They begin on Christmas Day and end on January 5, the eve of the Epiphany. This countdown runs in the twelve days *before* Christmas instead.' },
      { id: 'd12-q2', prompt: 'If every verse repeats all the earlier gifts, how many gifts does the true love send in total?', options: ['78', '144', '364', '365'], answer: 2, explain: 'Day 12 alone brings 1 + 2 + … + 12 = 78 gifts. Adding up all twelve days gives 364.' },
      { id: 'd12-q3', prompt: 'The idea that the song was a secret catechism code for persecuted Catholics is…', options: ['Documented in 16th-century church records', 'A modern myth with no evidence', 'Confirmed by the 1780 printing', 'The reason the song has twelve verses'], answer: 1, explain: 'The theory was first put forward in 1979 with no supporting evidence, and none of the gifts would have marked anyone out as Catholic.' },
    ],
  },
  {
    n: 11,
    title: 'Eleven pipers, and a fast that began on 11/11',
    emoji: '🪈',
    lesson: `On the eleventh day the song brings **eleven pipers piping**. Because verses repeat, the pipers show up on days 11 and 12, so the true love sends **22** pipers in all.

By the end of day 11, the running total of gifts is **286**. The running totals (1, 4, 10, 20, 35, …) are the *tetrahedral numbers*: the number of oranges you'd need to stack a triangular pyramid.

Eleven also matters on the calendar. In early medieval Gaul, a pre-Christmas fast called **St. Martin's Lent** began on St. Martin's Day, **November 11**. It's one of the roots of the season of Advent.`,
    questions: [
      { id: 'd11-q1', prompt: 'Counting every repeat, how many pipers does the true love send in the whole song?', options: ['11', '22', '33', '66'], answer: 1, explain: 'Pipers arrive on day 11 and again on day 12: 11 × 2 = 22.' },
      { id: 'd11-q2', prompt: 'By the end of day 11, how many gifts have arrived in total?', options: ['66', '220', '286', '364'], answer: 2, explain: 'The running total after day n is n(n+1)(n+2)/6. For n = 11 that is 11 × 12 × 13 / 6 = 286.' },
      { id: 'd11-q3', prompt: 'St. Martin\'s Lent, an early forerunner of Advent, began on which date?', options: ['November 1', 'November 11', 'December 1', 'December 11'], answer: 1, explain: 'It started on St. Martin\'s Day, November 11, and ran through the weeks before Christmas.' },
    ],
  },
  {
    n: 10,
    title: 'December, the "tenth" month',
    emoji: '📅',
    lesson: `**December** comes from the Latin *decem*, **ten**. In the early Roman calendar the year began in March, so December really was the tenth month. When January and February were placed at the start of the year, the name stayed and the count didn't.

Its neighbours have the same story: **September** (*septem*, 7), **October** (*octo*, 8) and **November** (*novem*, 9).

In the song, day 10 brings **ten lords a-leaping**. That single day delivers **55** gifts (1 + 2 + … + 10), and by its end the running total is **220**.`,
    questions: [
      { id: 'd10-q1', prompt: 'Why is December named after the Latin word for "ten"?', options: ['It has ten public holidays in Rome', 'It was the tenth month when the Roman year began in March', 'Christmas is ten days into it', 'It was the tenth month added to the calendar'], answer: 1, explain: 'With March as the first month, December was tenth. The names kept their old numbers after January and February moved to the front.' },
      { id: 'd10-q2', prompt: 'Which month\'s name comes from the Latin for "nine"?', options: ['September', 'October', 'November', 'December'], answer: 2, explain: '*Novem* is nine, so November. September is 7, October 8, December 10.' },
      { id: 'd10-q3', prompt: 'How many gifts arrive on day 10 of the song, on that day alone?', options: ['10', '45', '55', '220'], answer: 2, explain: 'Day 10 repeats every earlier gift: 1 + 2 + … + 10 = 55. The 220 is the running total across days 1 to 10.' },
    ],
  },
  {
    n: 9,
    title: 'Nine dawns of Simbang Gabi',
    emoji: '⛪',
    lesson: `In the Philippines, **Simbang Gabi** is a novena of **nine** dawn Masses from **December 16 to 24**. Tradition says that if you complete all nine, your wish will be granted. Afterwards, *bibingka* and *puto bumbong* wait outside the church.

Nine turns up elsewhere too. Mexico's **Las Posadas** runs for nine nights over the same dates, December 16 to 24. Since **1918**, King's College, Cambridge has held a **Festival of Nine Lessons and Carols** every Christmas Eve.

And Santa's best-known reindeer, **Rudolph**, is usually shown as the **ninth**. Robert L. May created him in **1939** for a Montgomery Ward department-store booklet.`,
    questions: [
      { id: 'd9-q1', prompt: 'Simbang Gabi is a series of nine Masses held…', options: ['On the nine days after Christmas', 'At dawn from December 16 to 24', 'Every Sunday from September to December', 'At midnight from December 1 to 9'], answer: 1, explain: 'It is a nine-day novena of dawn Masses, December 16 to 24, ending on Christmas Eve.' },
      { id: 'd9-q2', prompt: 'Which Christmas tradition also lasts nine nights, from December 16 to 24?', options: ['Las Posadas (Mexico)', 'Hanukkah', 'Boxing Day', 'The Twelve Days of Christmas'], answer: 0, explain: 'Las Posadas re-enacts Mary and Joseph\'s search for lodging over nine nights. Hanukkah lasts eight nights, and its dates move every year.' },
      { id: 'd9-q3', prompt: 'Rudolph, usually shown as Santa\'s ninth reindeer, was created in 1939 for…', options: ['A Hollywood film', 'A department-store promotional booklet', 'A newspaper comic strip', 'A church Christmas pageant'], answer: 1, explain: 'Robert L. May wrote the story for Montgomery Ward to give away to shoppers. The famous song came about a decade later.' },
    ],
  },
  {
    n: 8,
    title: 'Eight tiny reindeer',
    emoji: '🦌',
    lesson: `The poem **"A Visit from St. Nicholas"** ("'Twas the night before Christmas") was first published anonymously in **1823**. It gave Santa a sleigh pulled by **eight** reindeer and named every one of them.

Two of the names began as Dutch. The first printing had **"Dunder and Blixem"**, echoing the Dutch for *thunder and lightning*. Later versions changed them to **Donder** (or Donner) and **Blitzen**. Rudolph didn't join the team until 1939, which made nine.

Back in the song, day 8 brings **eight maids a-milking**. They come on days 8 to 12, so that's **40** maids in all.`,
    questions: [
      { id: 'd8-q1', prompt: 'How many reindeer pull Santa\'s sleigh in the 1823 poem "A Visit from St. Nicholas"?', options: ['Six', 'Eight', 'Nine', 'Twelve'], answer: 1, explain: 'The poem names eight. Rudolph, the famous ninth, came more than a century later, in 1939.' },
      { id: 'd8-q2', prompt: 'The reindeer names "Dunder and Blixem" in the first printing come from Dutch words meaning…', options: ['Snow and ice', 'Thunder and lightning', 'Star and moon', 'Fast and faster'], answer: 1, explain: '*Donder en bliksem*, thunder and lightning. They later became Donder and Blitzen.' },
      { id: 'd8-q3', prompt: 'Counting every repeat, how many maids a-milking are sent in the song?', options: ['8', '16', '40', '64'], answer: 2, explain: 'They arrive on days 8, 9, 10, 11 and 12: 8 × 5 = 40.' },
    ],
  },
  {
    n: 7,
    title: 'Seven swans, and a surprising tie',
    emoji: '🦢',
    lesson: `On day 7 come **seven swans a-swimming**. Here's a puzzle: across the whole song, which gift does the true love send the most of?

The gift from day *k* repeats on every later day, so it arrives **13 − k** times, *k* at a time: **k × (13 − k)** in total. That product peaks in the middle. **Swans (7 × 6)** and **geese a-laying (6 × 7)** tie at **42** each. The twelve drummers only total 12, and the partridge just 12 too.

Seven also appears at the Christmas table. In many Italian-American families, Christmas Eve is the **Feast of the Seven Fishes**, a meatless seafood dinner.`,
    questions: [
      { id: 'd7-q1', prompt: 'Across the whole song, which gifts are sent in the greatest number?', options: ['Drummers drumming', 'Partridges in pear trees', 'Swans a-swimming and geese a-laying (a tie)', 'Lords a-leaping'], answer: 2, explain: 'Gift k arrives k × (13 − k) times. That peaks at k = 6 and k = 7, giving 42 geese and 42 swans.' },
      { id: 'd7-q2', prompt: 'How many partridges (in pear trees) are sent in total?', options: ['1', '12', '42', '78'], answer: 1, explain: 'One partridge arrives on each of the 12 days: 1 × 12 = 12.' },
      { id: 'd7-q3', prompt: 'The "Feast of the Seven Fishes" is a Christmas Eve tradition mainly associated with…', options: ['Filipino Noche Buena', 'Italian-American families', 'Mexican Las Posadas', 'Scandinavian Lucia Day'], answer: 1, explain: 'It is a meatless seafood dinner on Christmas Eve, popular among Italian-Americans.' },
    ],
  },
  {
    n: 6,
    title: 'Six-sided snowflakes',
    emoji: '❄️',
    lesson: `Look closely at a snowflake and you'll usually count **six** arms. That isn't decoration: water molecules lock into a **hexagonal** crystal lattice as they freeze, and the six-fold shape of the flake comes from it. Real flakes are rarely perfectly symmetrical, but the six-sided pattern shows through.

Six also made Christmas history in orbit. On **December 16, 1965**, the astronauts of **Gemini 6A**, Wally Schirra and Tom Stafford, played **"Jingle Bells"** on a smuggled harmonica and small bells. They were the first musical instruments ever played in space.`,
    questions: [
      { id: 'd6-q1', prompt: 'Why do snowflakes usually have six arms?', options: ['Wind shapes them as they fall', 'Ice forms a hexagonal crystal lattice', 'Clouds contain six kinds of water', 'They break into six pieces when they land'], answer: 1, explain: 'Frozen water molecules arrange themselves in a hexagonal lattice, and the flake grows outward along that six-fold pattern.' },
      { id: 'd6-q2', prompt: 'Which song did the Gemini 6A astronauts play in space in December 1965?', options: ['Silent Night', 'Jingle Bells', 'Deck the Halls', 'O Holy Night'], answer: 1, explain: 'Schirra and Stafford played "Jingle Bells" on a harmonica and bells: the first instruments played in space.' },
      { id: 'd6-q3', prompt: 'A snowflake is a crystal of which substance?', options: ['Frozen carbon dioxide', 'Water ice', 'Salt', 'Frozen nitrogen'], answer: 1, explain: 'Snow is water ice. "Dry ice" is frozen carbon dioxide, which doesn\'t form snowflakes.' },
    ],
  },
  {
    n: 5,
    title: 'The five-pointed parol',
    emoji: '⭐',
    lesson: `The **parol** is the Philippines' Christmas lantern. Its most common form is a **five-pointed star**, standing for the **Star of Bethlehem** that guided the Magi. Parols have been made with anywhere from four to ten points, but five became the standard.

Some of the most spectacular parols light up **San Fernando, Pampanga**, at its **Giant Lantern Festival** each December. Its motorised lanterns run to many metres across and flash in patterns set to music.

In the song, day 5 brings **five golden rings**. They arrive on days 5 to 12, so that's **40** rings in all.`,
    questions: [
      { id: 'd5-q1', prompt: 'The usual five-pointed star shape of the parol represents…', options: ['The five senses', 'The Star of Bethlehem', 'The five main islands', 'The five days of Simbang Gabi'], answer: 1, explain: 'The star recalls the Star of Bethlehem. (Simbang Gabi has nine Masses, not five.)' },
      { id: 'd5-q2', prompt: 'Which city is famous for its Giant Lantern Festival?', options: ['Vigan', 'San Fernando, Pampanga', 'Baguio', 'Davao'], answer: 1, explain: 'San Fernando, Pampanga holds the Giant Lantern Festival each December.' },
      { id: 'd5-q3', prompt: 'Counting every repeat, how many golden rings are sent in the song?', options: ['5', '25', '40', '60'], answer: 2, explain: 'Rings arrive on the 8 days from day 5 to day 12: 5 × 8 = 40.' },
    ],
  },
  {
    n: 4,
    title: 'Four Sundays, four "-ber" months',
    emoji: '🕯️',
    lesson: `**Advent**, the season of waiting before Christmas, has **four Sundays** in the modern Roman calendar. Many churches and homes light one more candle on an **Advent wreath** each Sunday, until all four are burning.

Filipinos famously start much earlier. Once the **"-ber months"** begin (Septem**ber**, Octo**ber**, Novem**ber**, Decem**ber**), the Christmas songs come out. That makes the Philippine Christmas season about **four months** long, one of the longest in the world.

And in Dickens's ***A Christmas Carol*** (1843), Scrooge meets **four** ghosts: his late partner **Marley**, then the Ghosts of Christmas Past, Present and Yet to Come.`,
    questions: [
      { id: 'd4-q1', prompt: 'How many Sundays does Advent have in the modern calendar?', options: ['Three', 'Four', 'Six', 'Twelve'], answer: 1, explain: 'Four, which is why an Advent wreath usually holds four candles, one lit each Sunday.' },
      { id: 'd4-q2', prompt: 'In the Philippines, the "-ber months" that kick off the Christmas season are…', options: ['October to January', 'September to December', 'November to February', 'December only'], answer: 1, explain: 'September, October, November and December: four months, all ending in "-ber".' },
      { id: 'd4-q3', prompt: 'In "A Christmas Carol", who is the first ghost to visit Scrooge?', options: ['The Ghost of Christmas Past', 'Jacob Marley', 'The Ghost of Christmas Yet to Come', 'Tiny Tim'], answer: 1, explain: 'Marley, his old business partner, comes first and warns him of the three spirits to follow, making four ghosts in all.' },
    ],
  },
  {
    n: 3,
    title: 'Three gifts, but how many kings?',
    emoji: '👑',
    lesson: `The Gospel of Matthew says the Magi brought the infant Jesus **three gifts**: **gold, frankincense and myrrh**.

Here's the surprise: the Bible **never says how many Magi** there were. "Three" was inferred from the three gifts, and the names **Caspar, Melchior and Balthasar** were added by later tradition.

Their visit is remembered on **January 6**, the **Epiphany**, also called **Three Kings' Day** (*Araw ng Tatlong Hari*). In popular Filipino practice it's traditionally the close of the Christmas season.`,
    questions: [
      { id: 'd3-q1', prompt: 'Which three gifts did the Magi bring, according to Matthew?', options: ['Gold, silver and bronze', 'Gold, frankincense and myrrh', 'Bread, wine and oil', 'Myrrh, cinnamon and gold'], answer: 1, explain: 'Gold, frankincense (a fragrant resin burned as incense) and myrrh (a resin used in perfume and anointing).' },
      { id: 'd3-q2', prompt: 'Where does the idea of exactly three wise men come from?', options: ['Matthew counts them as three', 'It was inferred from the three gifts', 'Luke lists their three names', 'A 19th-century Christmas carol'], answer: 1, explain: 'The Bible gives no number. Three gifts suggested three givers, and the names came from later tradition.' },
      { id: 'd3-q3', prompt: 'Three Kings\' Day (the Epiphany) falls on…', options: ['December 24', 'December 28', 'January 1', 'January 6'], answer: 3, explain: 'January 6, the day after the Twelve Days of Christmas end.' },
    ],
  },
  {
    n: 2,
    title: 'Two Christmas dates',
    emoji: '🗓️',
    lesson: `Most of the world celebrates Christmas on **December 25**, but many **Orthodox** Christians (in Russia, Serbia, Ethiopia and elsewhere) celebrate it on **January 7**. They still mark December 25, but on the older **Julian calendar**, which now runs **13 days** behind the Gregorian one we use.

The **second** day of Christmas, **December 26**, is **St. Stephen's Day**, also known as **Boxing Day** in Britain and many Commonwealth countries. The carol *Good King Wenceslas* is set "on the Feast of Stephen".

And on day 2 of the song come **two turtle doves**. They arrive on 11 of the 12 days, so that's **22** doves in total.`,
    questions: [
      { id: 'd2-q1', prompt: 'Why do many Orthodox Christians celebrate Christmas on January 7?', options: ['They count from Christmas Eve differently', 'They keep December 25 on the Julian calendar, now 13 days behind', 'January 7 is the Epiphany', 'It was moved to avoid New Year'], answer: 1, explain: 'December 25 on the Julian calendar falls on January 7 on the Gregorian calendar.' },
      { id: 'd2-q2', prompt: '"Good King Wenceslas looked out, on the Feast of Stephen". Which day is that?', options: ['December 24', 'December 26', 'January 1', 'January 6'], answer: 1, explain: 'St. Stephen\'s Day is December 26, the second day of Christmas (also Boxing Day).' },
      { id: 'd2-q3', prompt: 'Counting every repeat, how many turtle doves are sent in the song?', options: ['2', '12', '22', '24'], answer: 2, explain: 'Doves arrive on days 2 through 12, which is 11 days: 2 × 11 = 22.' },
    ],
  },
  {
    n: 1,
    title: 'One silent, holy night',
    emoji: '🌟',
    lesson: `The countdown ends on **one** night: **Christmas Eve**, December 24.

**"Silent Night"** was first performed on Christmas Eve **1818** at St. Nicholas Church in **Oberndorf, Austria**. Joseph Mohr wrote the words (as a poem, in 1816) and Franz Xaver Gruber composed the melody. You may hear that it was written because the church organ broke. That story is a later invention, not documented fact.

In the Philippines, the night ends in **Noche Buena**, the Christmas Eve feast after midnight Mass, with **hamon**, **queso de bola** and more. Over it all shines **one** star, the **Star of Bethlehem**, which in Matthew's Gospel guides the Magi.

**Maligayang Pasko!** 🎄`,
    questions: [
      { id: 'd1-q1', prompt: 'Where was "Silent Night" first performed, on Christmas Eve 1818?', options: ['Vienna, Austria', 'Oberndorf, Austria', 'Bethlehem', 'Cambridge, England'], answer: 1, explain: 'At St. Nicholas Church in Oberndorf, near Salzburg, with words by Joseph Mohr and music by Franz Xaver Gruber.' },
      { id: 'd1-q2', prompt: 'The popular story that "Silent Night" was written because the church organ broke is…', options: ['Recorded in Gruber\'s own diary', 'A later invention, not documented fact', 'Confirmed by the church\'s repair bills', 'The reason it was first sung with a guitar'], answer: 1, explain: 'There is no evidence for the broken-organ tale. It spread through 20th-century retellings.' },
      { id: 'd1-q3', prompt: 'What is Noche Buena?', options: ['The first dawn Mass of Simbang Gabi', 'The Filipino Christmas Eve feast', 'A Christmas lantern', 'The New Year\'s Eve meal'], answer: 1, explain: 'Noche Buena is the Christmas Eve feast, usually after midnight Mass. The New Year\'s Eve meal is Media Noche.' },
    ],
  },
];
