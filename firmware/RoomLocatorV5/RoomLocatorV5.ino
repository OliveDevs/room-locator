/*
  Room Locator
  Diana Caballero and Gauri Sharma
  60-223 Introduction to Physical Computing, Fall 2026, campus client project for IDeATe Lending

  What it does
  A desk console for the IDeATe Lending office. Find a thing by browsing categories, typing its name, or
  scanning its barcode, and the shelf it lives on lights up green on a small model of the room. Staff can
  also move a thing, a whole shelf, or swap two units, take shelf boards in and out, and add new items,
  either with the buttons and keyboard or by scanning a QR code from the project website. Every change asks
  for the staff PIN first and is saved on the SD card, so the laptop can collect it later. A QR code on each
  item's screen opens its how-to page on the website.

  Pin mapping (Arduino Mega 2560)
    3.5 in ILI9486 TFT shield   plugs onto the Mega; its SD card slot uses SPI: 50 MISO, 51 MOSI, 52 SCK, 53 CS
    81 WS2812 lights (model)    data on A13 through a 330 ohm resistor; 5 V and GND from their own 5 V supply
    Buttons (to GND, no resistor, internal pull-ups)
                                A8 Up, A9 Down, A10 Select, A11 Back
    CardKB2 keyboard (I2C 0x5F) 20 SDA, 21 SCL, 5 V, GND
    2D barcode scanner          Serial1, 9600 baud: scanner TX to pin 19 (RX1), 5 V, GND
    Power                       two separate supplies, sharing one ground.
                                1. The Mega: a 9 V 1 A adapter into its own barrel jack, OR a laptop over USB.
                                   One at a time, never both. The wiring is left stock, so either works with
                                   nothing to change.
                                2. The lights: their own 5 V 3 A supply straight to the strip's 5 V and GND,
                                   because 81 WS2812s draw far more than the Mega can pass. A 1000 uF capacitor
                                   sits across that supply's 5 V and GND, and a 330 ohm resistor sits in the
                                   data line from pin A13.
                                The two grounds are tied together so the Mega and the strip agree on 0 V.
    Laptop (not needed to run)  USB, 115200 baud: only for uploading code and sending the SD card files

  Code from others (libraries)
    Adafruit GFX and Adafruit NeoPixel (Adafruit), MCUFRIEND_kbv (David Prentice), QRCode (Richard Moore),
    and the Arduino SD, SPI and Wire libraries.

  AI assistance
    Model: Claude Opus 5.5 (Anthropic), used Oct 27 to Nov 15, 2026.
    What Claude did: wrote some of this Arduino code and most of its comments, including most the screens, from our
    descriptions, and helped us debug it. It helped with the QR code generation and the GITHUB pages. 
    What we did: designed how the whole system works (a scale map of the real Lending office, which item lives on
    which shelf, the lights, the console with its scanner, keyboard and buttons, and the staff features for moving
    things), built and wired all the hardware, tested every version on it, found what did not work,
    and asked for each change.
    Prompts we used (in our own words), for example:
      "delete on the keyboard doesnt work can you troubleshoot that please"
      "Please help me design the Github pages so that staff can only access then with a PIN"
      "Help me debug the lights in the VR shelf, they are not lighting up properly"
    Earlier requests, summarized: make the list easier to reset, make the screens clearer and nicer to read,
    blink patterns so colorblind users are not relying on color, let staff move items and shelves with a QR code behind a PIN.
*/

// The file is in this order. Each part only uses the parts above it.
//   Settings and pins
//   What the console remembers
//   Drawing helpers
//   Lights
//   Data files on the SD card
//   Lists and search
//   Screens
//   Put-away list
//   Going between screens
//   Moving things and changing shelves
//   The staff PIN, phone QR codes, new items
//   Recent changes, Undo, and the website QR pages
//   Buttons
//   Scans and typing
//   Reading the inputs
//   setup() and loop()
//
// Files on the SD card (made on the laptop, sent with push_card.py):
//   UNITS.TSV   code, name, first light, how many lights, then (optional) its box on the map: x0 y0 x1 y1 in room mm / 2
//   STAFF.TSV   the staff PIN, 4 digits (no file = 1234). Changed on the console: grey bar on Home, the last spot on the map
//   BOARDS.TSV  made by the laptop, changed by the console: unit code, the grooves that have a board (like 1,2,3,5)
//               no line for a unit = a board in every groove
//   KINDS.TSV   category, type, name, unit, shelf, copies, good for, what it is
//   TYPES.TSV   category, type, how many kinds, where its first kind starts in KINDS.TSV
//   CODES.TSV   barcode, where its kind starts in KINDS.TSV
//   MOVES.TSV   made by the console, one line per change, played back in order over KINDS.TSV:
//                 name code, unit, shelf            one thing (every copy) moved
//                 S, unit, low, high, unit, shelf   everything on one shelf put on another shelf
//                 X, unit, low, high, unit, low, high   two shelves swapped
//                 B, unit, groove, 1 or 0[, S]      a board put in (1) or taken out (0); S = the line before moved its things down
//                 A, category, type, name, unit, shelf, copies   a new item was added (history only)
//                 U, unit, unit                     two whole units traded places in the room (each keeps its name, things
//                                                   and boards; the lights at each spot now belong to the other one)
// Shelf 1 is the BOTTOM shelf of a unit. The light for groove n is (first light + n - 1).
//
// Things you can type in the Serial Monitor (115200 baud, Newline), or that a scanner / the laptop can send:
//   LOC:AUD-3     a shelf label: shows that shelf. With an item open it moves the item there
//   CLEAR         back to the start
//   !U !D !S !B   press Up, Down, Select or Back
//   @             says hello (the laptop tools use this)
//   @LIGHTS       light check: every light red, green, then blue, then all green until a button is pressed
//   @MOVES        prints MOVES.TSV, then @END
//   @CLEARMOVES   deletes MOVES.TSV (after the laptop has collected the changes)
//   @ADDED        prints the items added at the console (and their barcodes), then @END
//   @PUT NAME N   the laptop sends a .TSV file of N bytes for the card
//   anything else is a barcode or a search word

#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <Adafruit_GFX.h>
#include <MCUFRIEND_kbv.h>
#include <Adafruit_NeoPixel.h>
#include <qrcode.h>
#include <Fonts/FreeSans9pt7b.h>
#include <Fonts/FreeSansBold9pt7b.h>
#include <Fonts/FreeSansBold12pt7b.h>
#include <Fonts/FreeSansBold18pt7b.h>

// ============================== Settings and pins ==============================
const char VERSION[] PROGMEM = "5.6";
const int LED_PIN = A13;                       // data wire of the light chain (through the 330 ohm resistor)
const int NUM_LEDS = 81;
const byte LED_BRIGHTNESS = 50;                // out of 255. Keeps the power supply cool
const int SD_CS_PIN = 53;                      // the card slot on the back of the screen
enum Button { B_UP, B_DOWN, B_SELECT, B_BACK, BUTTON_COUNT };
const int BUTTON_PIN[BUTTON_COUNT] = {A8, A9, A10, A11};   // each red button goes from its pin to GND
const byte KEYBOARD_ADDR = 0x5F;               // CardKB2 on I2C (pins 20 and 21)
const long SCANNER_BAUD = 9600;                // scanner on Serial1 (pin 19)
const unsigned long HOLD_DELAY = 450;          // hold Up or Down this long and it starts to repeat
const unsigned long HOLD_REPEAT = 110;         // then one step this often
const unsigned long IDLE_MS = 120000;          // 2 minutes with nobody touching it: lights off, back to the start
const byte MAX_ROWS = 40;                      // longest list a screen can hold
const byte MAX_LIST = 8;                       // most things on the put-away list
const byte MAX_UNITS = 20;
const byte MAX_MOVES = 128;                    // most changes the console keeps before the laptop must collect them
const byte ROWS_ON_SCREEN = 5;
// the QR on an item opens its page: this address plus 6 letters/digits worked out from the item's name
const char MANUAL_URL[] PROGMEM = "https://olivedevs.github.io/room-locator/?i=";
const char STAFF_URL[] PROGMEM = "https://olivedevs.github.io/room-locator/staff.html";   // the staff page, shown as a QR on the map

// colours: RGB() turns red, green, blue (0 to 255) into the screen's format
#define RGB(r, g, b) ((uint16_t)((((r) & 0xF8) << 8) | (((g) & 0xFC) << 3) | ((b) >> 3)))
const uint16_t BG = RGB(18, 22, 28), PANEL = RGB(30, 36, 45), PICKED = RGB(52, 64, 84), WHITE = 0xFFFF,
               DIM = RGB(154, 163, 178), ACCENT = RGB(255, 210, 74), BLACK = 0x0000, GREEN = RGB(62, 207, 142);
const uint16_t CAT_COLOR[8] = {RGB(79, 140, 255), RGB(62, 207, 142), RGB(255, 176, 32), RGB(179, 136, 255),
                               RGB(255, 107, 157), RGB(247, 140, 108), RGB(160, 170, 185), RGB(90, 209, 230)};
const char CAT_NAME[8][12] PROGMEM = {"Photo/Video", "Audio", "Lighting", "Computing", "VR", "Soft Tech", "Tools", "Cables"};

// light colours (0xRRGGBB)
const uint32_t LIGHT_ITEM = 0x00FF00;          // where an item lives
const uint32_t LIGHT_SHELF = 0xFFFFFF;         // a scanned shelf label
const uint32_t LIGHT_NEW_SPOT = 0x0050FF;      // where a moved item will go
const uint32_t LIGHT_SWEEP = 0x8000FF;         // the start-up check
const uint32_t LIGHT_UNIT = 0x303030;          // a whole unit, picked on the map
const uint32_t LIGHT_GROOVE = 0xFF8000;        // an empty groove where a board could go
// one light colour and one blink per thing on the put-away list, so nobody has to tell colours apart
const uint32_t LIST_RGB[6] = {0x00FF00, 0x0050FF, 0xFF8000, 0xFF00A0, 0x00E0E0, 0xFFE000};
const bool LIST_BLINKS = true;                // put-away list: false = each thing's light stays on in its colour, true = each also blinks its own pattern
const char BLINK_NAME[6][8] PROGMEM = {"steady", "slow", "fast", "double", "triple", "long"};

// ============================== What the console remembers ==============================
MCUFRIEND_kbv tft;
Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

// the screens (stored in a byte so the Arduino prototype maker is happy)
enum { HOME, TYPES, KINDS, RESULTS, SHELF, ITEM, PUTAWAY, MAP, UNITVIEW, ACTIONS, MOVEOK, PIN, ADDNEW, RECENT, SYNC };
byte mode = HOME;                               // which screen is showing
const byte BACK_MAX = 10;
byte backTo[BACK_MAX], backCursor[BACK_MAX], backStage[BACK_MAX], backView[BACK_MAX]; byte backDepth = 0;     // where Back returns to
unsigned long lastActivity = 0;                 // last time anything was pressed, scanned or typed

// the list on screen
long row[MAX_ROWS];                             // what it holds: positions in TYPES.TSV or KINDS.TSV (or unit / shelf numbers when moving)
byte rowCount = 0, cursor = 0;
byte homeCursor = 0, currentCat = 0;
long currentType = 0, currentKind = 0;          // positions in TYPES.TSV / KINDS.TSV
char typeName[28];
char shelfUnit[5]; byte shelfNumber = 0;        // the shelf a scanned label points at

// typing
char query[32]; byte queryLen = 0;              // what is being typed
bool live = false, livePending = false;         // live = the list on screen is a search that updates as you type
unsigned long liveAt = 0;

// the put-away list
long listKind[MAX_LIST]; int listLed[MAX_LIST]; byte listSpan[MAX_LIST]; byte listColor[MAX_LIST]; byte listCount = 0;
bool itemWasScanned = false;                    // the open item came from a scan (so a second scan starts the list)

// moving and changing shelves
enum { W_ITEM, W_SHELF, W_UNIT, W_ADDBOARD, W_DELBOARD };      // what is being changed
enum { ST_FROM, ST_TO };                                         // picking what to change, or where it goes
byte moveWhat = W_ITEM, stage = ST_FROM, viewUnit = 0;          // viewUnit = the unit on the side-view screen
byte fromUnit = 0, fromLo = 0, fromHi = 0;                      // the shelf (or unit) being moved
byte moveToUnit = 0, moveToShelf = 0;           // where it goes
bool toNewBoard = false, swapShelves = false;   // a new board goes in first / the two shelves trade places
byte fromCount = 0;                             // things on the shelf being moved or taken out
byte moveFromDepth = 0;                         // where Back returns once an item move is done
byte doneNote = 0;                               // what the "Done" footer adds: 1 = move the label card, 2 = swap the bodies, 3 = undone
byte syncPage = 0, syncPages = 1;                 // the QR pages for the website
bool justMoved = false, justChanged = false, justAdded = false;    // the next screen says "Moved" / "Done" / "Added" once
// the staff PIN
const unsigned long STAFF_MS = 300000UL;        // once the PIN is right, changes are open for 5 minutes
char staffPin[5] = "1234";
unsigned long staffUntil = 0;
enum { P_ENTER, P_NEW1, P_NEW2 };               // typing the PIN / a new PIN / the new PIN again
enum { AFTER_ORGANIZE, AFTER_MOVE, AFTER_CODE, AFTER_DOMOVE, AFTER_NOTHING };   // what happens once the PIN is right
byte pinStep = P_ENTER, pinAfter = AFTER_NOTHING, pinLen = 0, pinDigit = 0;
char pinIn[5], pinNew[5];
bool pinWrong = false, pinMismatch = false;
char pendingCode[72];                           // a phone QR code waiting for the PIN
bool homeMessage = false;                        // a message is on the screen in place of Home: the next button just shows Home
// a new item from the phone (RL:ADD), set up in 3 steps
byte addStep = 1, addCat = 0, addUnit = 0, addShelf = 0, addCopies = 1;
char addName[40], addType[28], addCode[40], addProblem[48];
long addedFrom = 0;                             // where the original KINDS.TSV ends: items added at the console come after this
struct Change { char type; byte a[6]; };        // one line of MOVES.TSV kept in memory: type 'I' (a thing), 'S' or 'X' (see the top)
Change changes[MAX_MOVES]; byte moveTotal = 0;
char movedUnit[5], movedShelf[4];
byte thingCount[17];                            // things on each shelf of the unit on screen (by its bottom groove)

// the data files
File kindsFile;                                 // KINDS.TSV stays open: every screen reads from it
char unitCode[MAX_UNITS][5];
char unitName[MAX_UNITS][15];
byte unitFirst[MAX_UNITS], unitCount[MAX_UNITS];
uint16_t unitBoards[MAX_UNITS];                 // bit n-1 set = groove n has a board (groove 1, the floor, always counts)
byte unitMap[MAX_UNITS][4];                     // its box on the map (room mm / 2), 255 = not on the map
byte unitTotal = 0;
char line[200];                                 // the one line being looked at right now
char* field[8];                                 // where each of its fields starts
enum { K_CAT, K_TYPE, K_NAME, K_UNIT, K_SHELF, K_COPIES, K_GOOD, K_WHAT };    // the fields of a KINDS.TSV line

const byte SYNC_QR = 8;                         // the website QR: version 8 = 49 x 49 dots, holds 192 letters
uint8_t qrData[304];                            // room for a QR's dots: the item QR (33 x 33) and the website QR (49 x 49) share it

// ============================== Drawing helpers ==============================
enum Font { SMALL, BOLD, TITLE, HUGE_FONT };
void useFont(Font f) {
  tft.setFont(f == SMALL ? &FreeSans9pt7b : f == BOLD ? &FreeSansBold9pt7b : f == TITLE ? &FreeSansBold12pt7b : &FreeSansBold18pt7b);
  tft.setTextSize(1);
}
int textWidth(const char* s) { int16_t x, y; uint16_t w, h; tft.getTextBounds(s, 0, 0, &x, &y, &w, &h); return w; }
void copyText(char* to, const char* from, size_t size) { strncpy(to, from, size - 1); to[size - 1] = '\0'; }   // copy that never overruns

// draws text with its baseline at y. Cuts it with ".." if it is wider than maxW
void text(int x, int y, const char* s, uint16_t color, Font f, int maxW = 460) {
  char buf[64];
  copyText(buf, s, sizeof(buf));
  useFont(f);
  int n = strlen(buf);
  while (n > 3 && textWidth(buf) > maxW) { n--; buf[n] = '\0'; buf[n - 1] = '.'; buf[n - 2] = '.'; }
  tft.setTextColor(color); tft.setCursor(x, y); tft.print(buf);
}
void textF(int x, int y, const __FlashStringHelper* s, uint16_t color, Font f) {     // the same for text kept in flash: F("...")
  char buf[64]; strncpy_P(buf, (const char*)s, sizeof(buf) - 1); buf[sizeof(buf) - 1] = '\0';
  text(x, y, buf, color, f);
}
void rightText(const char* s) { useFont(SMALL); text(466 - textWidth(s), 28, s, DIM, SMALL); }     // grey text at the top right
// a paragraph: breaks at spaces, at most maxLines lines. Returns how many lines it used
byte paragraph(int x, int y, const char* s, uint16_t color, int maxW, byte maxLines) {
  char lineBuf[64]; byte len = 0, lines = 0;
  useFont(SMALL);
  const char* p = s;
  while (*p && lines < maxLines) {
    const char* wordEnd = p; while (*wordEnd && *wordEnd != ' ') wordEnd++;
    byte wlen = wordEnd - p;
    if (len + wlen + 1 >= (int)sizeof(lineBuf)) wlen = sizeof(lineBuf) - len - 2;
    byte before = len;
    if (len) lineBuf[len++] = ' ';
    memcpy(lineBuf + len, p, wlen); len += wlen; lineBuf[len] = '\0';
    if (before && textWidth(lineBuf) > maxW) {            // the word does not fit: print the line without it
      lineBuf[before] = '\0';
      text(x, y + lines * 20, lineBuf, color, SMALL, maxW); lines++;
      len = 0; continue;                                   // and start the next line with the same word
    }
    p = wordEnd; while (*p == ' ') p++;
  }
  if (len && lines < maxLines) { text(x, y + lines * 20, lineBuf, color, SMALL, maxW); lines++; }
  return lines;
}
void header(const char* title, const char* right) {       // clears the screen and draws the title (and a grey note on the right)
  tft.fillScreen(BG);
  text(14, 30, title, WHITE, TITLE, right ? 330 : 450);
  if (right) rightText(right);
}
void footer(const __FlashStringHelper* hint) {            // the grey bar at the bottom
  tft.fillRect(0, 294, 480, 26, PANEL);
  textF(14, 312, hint, DIM, SMALL);
}
// the little picture for each category, drawn from simple shapes
void icon(byte cat, int cx, int cy, uint16_t c) {
  switch (cat) {
    case 0: tft.fillRoundRect(cx - 20, cy - 10, 40, 26, 4, c); tft.fillRect(cx - 8, cy - 16, 16, 7, c); tft.fillCircle(cx, cy + 3, 8, PANEL); tft.fillCircle(cx, cy + 3, 4, c); break;   // camera
    case 1: tft.fillRoundRect(cx - 7, cy - 18, 14, 24, 7, c); tft.drawCircle(cx, cy - 2, 13, c); tft.fillRect(cx - 14, cy - 16, 28, 14, PANEL); tft.fillRoundRect(cx - 7, cy - 18, 14, 24, 7, c);
            tft.drawFastVLine(cx, cy + 11, 7, c); tft.drawFastHLine(cx - 8, cy + 18, 17, c); break;                                                                             // microphone
    case 2: tft.fillCircle(cx, cy - 4, 13, c); tft.fillRect(cx - 6, cy + 8, 12, 9, c); tft.drawFastHLine(cx - 6, cy + 12, 12, PANEL); break;                                      // light bulb
    case 3: tft.drawRoundRect(cx - 17, cy - 15, 34, 23, 3, c); tft.drawRoundRect(cx - 16, cy - 14, 32, 21, 2, c); tft.fillRoundRect(cx - 23, cy + 10, 46, 6, 2, c); break;          // laptop
    case 4: tft.fillRoundRect(cx - 21, cy - 9, 42, 22, 8, c); tft.fillCircle(cx - 9, cy + 2, 5, PANEL); tft.fillCircle(cx + 9, cy + 2, 5, PANEL); tft.drawFastHLine(cx - 21, cy - 14, 42, c); break;   // headset
    case 5: tft.fillRect(cx - 14, cy - 16, 28, 5, c); tft.fillRect(cx - 14, cy + 12, 28, 5, c); tft.fillRect(cx - 9, cy - 11, 18, 23, c);
            for (int i = -7; i < 12; i += 5) { tft.drawFastHLine(cx - 9, cy + i, 18, PANEL); }
            break;                                                                               // spool of thread
    case 6: tft.fillRoundRect(cx - 18, cy - 16, 36, 12, 3, c); tft.fillRect(cx - 3, cy - 4, 7, 22, c); break;                                                                    // hammer
    default: tft.drawCircle(cx, cy, 16, c); tft.drawCircle(cx, cy, 15, c); tft.drawCircle(cx, cy, 10, c); tft.drawCircle(cx, cy, 9, c); tft.fillRect(cx + 12, cy - 3, 12, 6, c); break;  // coil of cable
  }
}

// ============================== Lights ==============================
void lightsOff() { strip.clear(); strip.show(); }
void lightOne(int led, uint32_t color) { strip.clear(); if (led >= 0) strip.setPixelColor(led, color); strip.show(); }
void addLights(int first, byte span, uint32_t color) { if (first < 0) return; for (byte i = 0; i < span; i++) if (first + i < NUM_LEDS) strip.setPixelColor(first + i, color); }
// is a light with this blink ON at time t?
bool blinkOn(byte pattern, unsigned long t) {
  if (!LIST_BLINKS) return true;
  unsigned long p;
  switch (pattern) {
    case 1: return (t % 1200) < 600;
    case 2: return (t % 300) < 150;
    case 3: p = t % 1200; return p < 150 || (p >= 300 && p < 450);
    case 4: p = t % 1500; return p < 120 || (p >= 240 && p < 360) || (p >= 480 && p < 600);
    case 5: return (t % 1600) < 1300;
    default: return true;
  }
}
// on the put-away screen every list item shows its own colour with its own blink
void blinkTick() {
  static int lastMask = -1;
  if (mode != PUTAWAY || listCount == 0) { lastMask = -1; return; }
  if (Serial1.available()) return;                                // never talk to the strip in the middle of a scan
  unsigned long t = millis();
  byte mask = 0;
  for (byte i = 0; i < listCount; i++) if (blinkOn(listColor[i], t)) mask |= (1 << i);
  if (mask == lastMask) return;
  lastMask = mask;
  strip.clear();
  for (byte i = 0; i < listCount; i++) if (mask & (1 << i)) addLights(listLed[i], listSpan[i], LIST_RGB[listColor[i]]);
  strip.show();
}

// ============================== Data files on the SD card ==============================
// cuts `line` into fields at the tabs. Returns how many there are
byte splitLine() {
  byte n = 0; field[n++] = line;
  for (char* p = line; *p; p++) {
    if (*p == '\r' || *p == '\n') { *p = '\0'; break; }
    if (*p == '\t' && n < 8) { *p = '\0'; field[n++] = p + 1; }
  }
  for (byte i = n; i < 8; i++) field[i] = line + strlen(line);   // missing fields read as empty text
  return n;
}
unsigned long nameCode(const char* s) {          // a short code made from a name (the website and the QR use the same one)
  unsigned long h = 2166136261UL;                                // FNV-1a: mix each letter into one number
  while (*s) { h ^= (byte)*s++; h *= 16777619UL; }
  return h & 0xFFFFFFUL;
}
int findUnit(const char* code) {                // -1 = no such unit
  for (byte i = 0; i < unitTotal; i++) if (strcasecmp(unitCode[i], code) == 0) return i;
  return -1;
}
// changes done at the console live in MOVES.TSV and are played back, in order, over KINDS.TSV every time a kind is read
bool moveListHasRoom(char type, unsigned long key) {   // a thing already on the list can always be moved again
  if (moveTotal < MAX_MOVES) return true;
  if (type == 'I') for (byte i = 0; i < moveTotal; i++) if (changes[i].type == 'I' && changes[i].a[0] == ((key >> 16) & 255) && changes[i].a[1] == ((key >> 8) & 255) && changes[i].a[2] == (key & 255)) return true;
  return false;
}
void rememberChange(char type, const byte* a) {          // call moveListHasRoom() first. A thing moved again: its old line goes, the new one is last
  if (type == 'I') {
    for (byte i = 0; i < moveTotal; i++) if (changes[i].type == 'I' && changes[i].a[0] == a[0] && changes[i].a[1] == a[1] && changes[i].a[2] == a[2]) {
      for (byte j = i; j + 1 < moveTotal; j++) changes[j] = changes[j + 1];
      moveTotal--; break;
    }
  }
  if (moveTotal >= MAX_MOVES) return;
  changes[moveTotal].type = type; memcpy(changes[moveTotal].a, a, 6); moveTotal++;
}
bool inRange(byte s, byte lo, byte hi) { return s >= lo && s <= hi; }
void applyMove() {                               // play every change back over the kind in `line`
  if (!moveTotal) return;
  int u = findUnit(field[K_UNIT]); int s = atoi(field[K_SHELF]);
  int u0 = u, s0 = s;
  unsigned long k = nameCode(field[K_NAME]);
  byte k0 = (k >> 16) & 255, k1 = (k >> 8) & 255, k2 = k & 255;
  for (byte i = 0; i < moveTotal; i++) {
    const byte* a = changes[i].a;
    switch (changes[i].type) {
      case 'I': if (a[0] == k0 && a[1] == k1 && a[2] == k2) { u = a[3]; s = a[4]; } break;
      case 'S': if (u == a[0] && inRange(s, a[1], a[2])) { u = a[3]; s = a[4]; } break;
      case 'X': if (u == a[0] && inRange(s, a[1], a[2])) { u = a[3]; s = a[4]; }
                else if (u == a[3] && inRange(s, a[4], a[5])) { u = a[0]; s = a[1]; }
                break;
    }
  }
  if (u == u0 && s == s0) return;
  if (u >= 0 && u < unitTotal) { strcpy(movedUnit, unitCode[u]); field[K_UNIT] = movedUnit; }
  itoa(s, movedShelf, 10); field[K_SHELF] = movedShelf;
}
// reads one line starting at `pos` into `line`. Returns where the next line starts, or -1 at the end of the file
bool searching = false;                          // true while the search reads every line: no need to replay changes
long readLine(File& f, long pos) {
  if (pos < 0 || (unsigned long)pos >= f.size()) return -1;
  f.seek(pos);
  int n = f.readBytesUntil('\n', line, sizeof(line) - 1);
  line[n] = '\0';
  long next = f.position();
  splitLine();
  if (&f == &kindsFile && !searching) applyMove();
  return next;
}
bool loadKind(long pos) { return readLine(kindsFile, pos) >= 0; }

void loadUnits() {
  File f = SD.open("UNITS.TSV");
  long pos = 0;
  unitTotal = 0;
  while (f && unitTotal < MAX_UNITS && (pos = readLine(f, pos)) >= 0) {
    if (!field[0][0]) continue;
    copyText(unitCode[unitTotal], field[0], sizeof(unitCode[0]));
    copyText(unitName[unitTotal], field[1], sizeof(unitName[0]));
    unitFirst[unitTotal] = atoi(field[2]); unitCount[unitTotal] = atoi(field[3]) > 16 ? 16 : atoi(field[3]);
    unitBoards[unitTotal] = 0xFFFF;
    for (byte i = 0; i < 4; i++) unitMap[unitTotal][i] = field[4][0] ? atoi(field[4 + i]) : 255;
    unitTotal++;
  }
  if (f) f.close();
}
// the staff PIN: STAFF.TSV, one line with 4 digits
void loadStaff() {
  strcpy_P(staffPin, PSTR("1234"));
  File f = SD.open("STAFF.TSV");
  if (!f) return;
  long pos = readLine(f, 0); f.close();
  if (pos >= 0 && strlen(field[0]) == 4) { bool digits = true; for (byte i = 0; i < 4; i++) if (!isdigit(field[0][i])) digits = false; if (digits) strcpy(staffPin, field[0]); }
}
bool saveStaff() {
  File f = SD.open("STAFF.TSV", O_WRITE | O_CREAT | O_TRUNC);
  if (!f) return false;
  f.println(staffPin); f.close(); return true;
}
bool staffOK() { return staffUntil != 0 && (long)(staffUntil - millis()) > 0; }
// which grooves have a board: BOARDS.TSV, one line per unit like  AUD<tab>1,2,3,5
void loadBoards() {
  File f = SD.open("BOARDS.TSV");
  long pos = 0;
  while (f && (pos = readLine(f, pos)) >= 0) {
    int u = findUnit(field[0]);
    if (u < 0 || !field[1][0]) continue;
    unitBoards[u] = 0;
    for (char* p = field[1]; *p; ) { int n = atoi(p); if (n >= 1 && n <= 16) unitBoards[u] |= (1 << (n - 1)); while (*p && *p != ',') p++; if (*p) p++; }
  }
  if (f) f.close();
}
bool saveBoards() {                              // writes the whole file again (it is tiny)
  File f = SD.open("BOARDS.TSV", O_WRITE | O_CREAT | O_TRUNC);
  if (!f) return false;
  for (byte u = 0; u < unitTotal; u++) {
    if (!unitCount[u]) continue;
    char buf[48]; byte len = snprintf_P(buf, sizeof(buf), PSTR("%s\t1"), unitCode[u]);
    for (byte n = 2; n <= unitCount[u]; n++) if ((unitBoards[u] >> (n - 1)) & 1) len += snprintf_P(buf + len, sizeof(buf) - len, PSTR(",%d"), n);
    f.println(buf);
  }
  f.close();
  return true;
}
bool hasBoard(byte u, byte n) { return n == 1 || ((unitBoards[u] >> (n - 1)) & 1); }
byte spaceLo(byte u, int s) {                    // the board a thing at groove s really sits on
  if (s < 1) return 0;
  byte n = s > unitCount[u] ? unitCount[u] : s;
  while (n > 1 && !hasBoard(u, n)) n--;
  return n;
}
byte spaceHi(byte u, byte lo) {                  // the top groove of the space that starts at board lo
  byte n = lo;
  while (n < unitCount[u] && !hasBoard(u, n + 1)) n++;
  return n;
}
byte unitIndex(const char* code) { int u = findUnit(code); return u < 0 ? 255 : u; }
void swapUnits(byte a, byte b) {                 // two units trade places in the room: name, code and boards go with the unit; lights and map spot stay
  char t[15];
  strcpy(t, unitCode[a]); strcpy(unitCode[a], unitCode[b]); strcpy(unitCode[b], t);
  strcpy(t, unitName[a]); strcpy(unitName[a], unitName[b]); strcpy(unitName[b], t);
  uint16_t w = unitBoards[a]; unitBoards[a] = unitBoards[b]; unitBoards[b] = w;
  for (byte i = 0; i < moveTotal; i++) {         // changes already kept point at units by number: keep them pointing at the same unit
    byte* c = changes[i].a; char ty = changes[i].type;
    byte* slot[2] = {ty == 'I' ? &c[3] : &c[0], &c[3]};
    for (byte k = 0; k < (ty == 'I' ? 1 : 2); k++) { if (*slot[k] == a) *slot[k] = b; else if (*slot[k] == b) *slot[k] = a; }
  }
}
void loadMoves() {
  File f = SD.open("MOVES.TSV");
  long pos = 0;
  moveTotal = 0;
  while (f && (pos = readLine(f, pos)) >= 0) {                     // first: units that traded places (everything else is by unit code)
    if (field[0][1] || toupper(field[0][0]) != 'U') continue;
    byte a[6] = {unitIndex(field[1]), unitIndex(field[2]), 0, 0, 0, 0};
    if (a[0] == 255 || a[1] == 255) continue;
    swapUnits(a[0], a[1]);
  }
  pos = 0;
  while (f && (pos = readLine(f, pos)) >= 0) {
    if (!field[0][0] || !field[1][0]) continue;
    byte a[6] = {0, 0, 0, 0, 0, 0};
    char t = field[0][1] ? 'I' : toupper(field[0][0]);
    if (t == 'U' || t == 'B' || t == 'A') continue;                 // units were done above; boards and new items are history only
    if (t == 'S' || t == 'X') { a[0] = unitIndex(field[1]); a[1] = atoi(field[2]); a[2] = atoi(field[3]); a[3] = unitIndex(field[4]); a[4] = atoi(field[5]); a[5] = atoi(field[6]); if (a[0] == 255 || a[3] == 255) continue; }
    else { t = 'I'; unsigned long k = strtoul(field[0], NULL, 16); a[0] = (k >> 16) & 255; a[1] = (k >> 8) & 255; a[2] = k & 255; a[3] = unitIndex(field[1]); a[4] = atoi(field[2]); if (a[3] == 255) continue; }
    rememberChange(t, a);
  }
  if (f) f.close();
}
bool saveChange(char type, const byte* a) {     // adds one line to MOVES.TSV
  File f = SD.open("MOVES.TSV", FILE_WRITE);                      // FILE_WRITE adds to the end
  if (!f) return false;
  char buf[48];
  if (type == 'I') snprintf_P(buf, sizeof(buf), PSTR("%02x%02x%02x\t%s\t%d"), a[0], a[1], a[2], unitCode[a[3]], a[4]);
  else if (type == 'S') snprintf_P(buf, sizeof(buf), PSTR("S\t%s\t%d\t%d\t%s\t%d"), unitCode[a[0]], a[1], a[2], unitCode[a[3]], a[4]);
  else if (type == 'X') snprintf_P(buf, sizeof(buf), PSTR("X\t%s\t%d\t%d\t%s\t%d\t%d"), unitCode[a[0]], a[1], a[2], unitCode[a[3]], a[4], a[5]);
  else if (type == 'B') snprintf_P(buf, sizeof(buf), a[3] ? PSTR("B\t%s\t%d\t%d\tS") : PSTR("B\t%s\t%d\t%d"), unitCode[a[0]], a[1], a[2]);
  else snprintf_P(buf, sizeof(buf), PSTR("U\t%s\t%s"), unitCode[a[0]], unitCode[a[1]]);
  f.println(buf); f.close();
  return true;
}
int ledFor(const char* code, int shelf) {       // the first light of the shelf a thing sits on. -1 = this place has no light
  int u = findUnit(code);
  if (u < 0 || shelf < 1 || shelf > unitCount[u]) return -1;
  return unitFirst[u] + spaceLo(u, shelf) - 1;
}
byte spanFor(const char* code, int shelf) {      // how many lights that shelf has (2 or more = a tall space with a board taken out)
  int u = findUnit(code);
  if (u < 0 || shelf < 1 || shelf > unitCount[u]) return 1;
  byte lo = spaceLo(u, shelf); return spaceHi(u, lo) - lo + 1;
}
void addPlace(const char* code, int shelf, uint32_t color) { addLights(ledFor(code, shelf), spanFor(code, shelf), color); }
void addSpace(byte u, byte lo, uint32_t color) { addLights(unitFirst[u] + lo - 1, spaceHi(u, lo) - lo + 1, color); }
long findCode(const char* code) {               // looks a barcode up in CODES.TSV. -1 = not there
  File f = SD.open("CODES.TSV");
  long pos = 0, found = -1;
  while (f && (pos = readLine(f, pos)) >= 0) if (strcasecmp(field[0], code) == 0) { found = atol(field[1]); break; }
  if (f) f.close();
  return found;
}
// "Audio, shelf 3" or "Ask at the desk (A3 Storage)" for the kind in `line`
void whereText(char* out, byte size) {
  int u = findUnit(field[K_UNIT]), shelf = atoi(field[K_SHELF]);
  const char* name = u >= 0 ? unitName[u] : field[K_UNIT];
  if (ledFor(field[K_UNIT], shelf) >= 0) snprintf_P(out, size, PSTR("%s, shelf %d"), name, spaceLo(u, shelf));
  else snprintf_P(out, size, PSTR("Ask at the desk (%s)"), name);
}

// ============================== Lists and search ==============================
// each loader fills row[] for its screen
void loadTypes() {
  File f = SD.open("TYPES.TSV");
  long pos = 0, next;
  rowCount = 0;
  while (f && rowCount < MAX_ROWS && (next = readLine(f, pos)) >= 0) { if (atoi(field[0]) == currentCat && field[1][0]) row[rowCount++] = pos; pos = next; }
  if (f) f.close();
}
void loadKinds() {
  File f = SD.open("TYPES.TSV"); readLine(f, currentType); f.close();
  copyText(typeName, field[1], sizeof(typeName));
  int cat = atoi(field[0]), n = atoi(field[2]); long pos = atol(field[3]);
  rowCount = 0;
  while (n-- > 0 && rowCount < MAX_ROWS) { long next = readLine(kindsFile, pos); if (next < 0) break; row[rowCount++] = pos; pos = next; }
  for (pos = addedFrom; addedFrom > 0 && rowCount < MAX_ROWS; ) {              // items added at the console sit at the end of the file
    long next = readLine(kindsFile, pos); if (next < 0) break;
    if (atoi(field[K_CAT]) == cat && strcasecmp(field[K_TYPE], typeName) == 0) row[rowCount++] = pos;
    pos = next;
  }
}
void findAddedFrom() {                           // the end of the last type's block in KINDS.TSV = where added items start
  File f = SD.open("TYPES.TSV");
  long pos = 0, last = -1; int n = 0;
  while (f && (pos = readLine(f, pos)) >= 0) if (atol(field[3]) > last) { last = atol(field[3]); n = atoi(field[2]); }
  if (f) f.close();
  addedFrom = 0;
  if (last < 0) return;
  long p = last;
  while (n-- > 0) { long next = readLine(kindsFile, p); if (next < 0) return; p = next; }
  addedFrom = p;
}
long findName(const char* name) {               // the kind with exactly this name. -1 = none
  long pos = 0, next;
  while ((next = readLine(kindsFile, pos)) >= 0) { if (strcasecmp(field[K_NAME], name) == 0) return pos; pos = next; }
  return -1;
}
long findNameCode(unsigned long code) {          // the kind whose 6-letter page code matches. -1 = none
  long pos = 0, next;
  while ((next = readLine(kindsFile, pos)) >= 0) { if (nameCode(field[K_NAME]) == code) return pos; pos = next; }
  return -1;
}
void loadShelf() {                              // everything on one shelf (shelfNumber is the board it sits on)
  long pos = 0, next;
  rowCount = 0;
  int u = findUnit(shelfUnit); if (u < 0) return;
  while (rowCount < MAX_ROWS && (next = readLine(kindsFile, pos)) >= 0) {
    if (strcasecmp(field[K_UNIT], shelfUnit) == 0 && (unitCount[u] ? spaceLo(u, atoi(field[K_SHELF])) : atoi(field[K_SHELF])) == shelfNumber) row[rowCount++] = pos;
    pos = next;
  }
}
// does `word` start a word in `hay`?  exact = it must be the whole word ("mic" is the word "Mic"), otherwise any start of a word counts ("mic" starts "Microphone").
// A typed plural also works: "tripods" finds Tripod, "cables" finds Cable
bool startsWord(const char* hay, const char* word, byte n, bool exact) {
  for (const char* p = hay; *p; p++) {
    if (p != hay && isalnum(*(p - 1))) continue;                 // only look at the starts of words
    if (strncasecmp(p, word, n) != 0) continue;
    if (!exact) return true;
    char after = p[n];
    if (!isalnum(after) || ((after == 's' || after == 'S') && !isalnum(p[n + 1]))) return true;
  }
  return false;
}
bool hasWord(const char* hay, const char* word, bool exact) {
  byte n = strlen(word);
  if (startsWord(hay, word, n, exact)) return true;
  if (n >= 5 && tolower(word[n - 1]) == 's' && startsWord(hay, word, n - 1, exact)) return true;                    // "tripods"
  if (n >= 6 && tolower(word[n - 1]) == 's' && tolower(word[n - 2]) == 'e' && startsWord(hay, word, n - 2, exact)) return true;   // "lenses"
  return false;
}
// 3 = every typed word is a whole word in the name, 2 = every word starts a word in the name, 1 = every word is somewhere in name/type/good for/what it is, 0 = no
byte matchKind(char words[4][12], byte count) {
  bool allInName = true, allWhole = true;
  for (byte w = 0; w < count; w++) {
    bool whole = hasWord(field[K_NAME], words[w], true);
    bool inName = whole || hasWord(field[K_NAME], words[w], false);
    if (!whole) allWhole = false;
    if (!inName) allInName = false;
    if (!inName && !hasWord(field[K_TYPE], words[w], false) && !hasWord(field[K_GOOD], words[w], false) && !hasWord(field[K_WHAT], words[w], false)) return 0;
  }
  return allInName ? (allWhole ? 3 : 2) : 1;
}
void loadResults() {
  char words[4][12]; byte count = 0;
  char copy[32]; copyText(copy, query, sizeof(copy));
  for (char* w = strtok(copy, " "); w && count < 4; w = strtok(NULL, " ")) { copyText(words[count], w, sizeof(words[0])); count++; }
  rowCount = 0;
  if (!count) return;
  // one pass over the file (it used to take three). Best matches first: whole words in the name, then starts of
  // words, then everything else; same-score matches keep their file order. If the list is full, a better match
  // pushes out the last of the weakest ones.
  byte score[MAX_ROWS];
  long pos = 0, next;
  searching = true;                                              // where things are does not matter for matching: skip the change replay
  while ((next = readLine(kindsFile, pos)) >= 0) {
    byte sc = matchKind(words, count);
    if (sc) {
      if (rowCount < MAX_ROWS) { row[rowCount] = pos; score[rowCount++] = sc; }
      else {
        byte weakest = 0;
        for (byte i = 1; i < rowCount; i++) if (score[i] <= score[weakest]) weakest = i;   // lowest score, latest in the file
        if (score[weakest] < sc) { for (byte i = weakest; i + 1 < rowCount; i++) { row[i] = row[i + 1]; score[i] = score[i + 1]; } row[rowCount - 1] = pos; score[rowCount - 1] = sc; }
      }
    }
    pos = next;
  }
  searching = false;
  for (byte i = 1; i < rowCount; i++) {                          // order by score, keeping file order inside a score
    long r = row[i]; byte sc = score[i]; byte j = i;
    while (j > 0 && score[j - 1] < sc) { row[j] = row[j - 1]; score[j] = score[j - 1]; j--; }
    row[j] = r; score[j] = sc;
  }
}
// ---- the move and shelf screens
enum { A_OPEN, A_MOVEALL, A_REMOVE, A_TOGETHER, A_SWAP };        // the choices on the ACTIONS screen
// rows on the side view of a unit: n = board n, 100 + n = empty groove n, 0 = "swap this whole unit"
const byte ROW_SWAP_UNIT = 0, ROW_GROOVE = 100;
// the last three spots on the map are not units
const byte ROW_PHONE = 251, ROW_RECENT = 252, ROW_SYNC = 253, ROW_PIN = 254;
const long ROW_UNDO = -1;                        // the first row of Recent changes
void loadRecent(); byte countSyncPages(); void drawSync();      // (further down)
void describeChange(long pos, char* top, byte topSize, char* under, byte underSize);
bool mapListed(byte u) {                         // which units the map walks through right now
  if (stage == ST_TO && moveWhat == W_ITEM) return true;                        // a thing can also go to a place with no lights
  if (!unitCount[u]) return false;
  if (stage == ST_TO && moveWhat == W_UNIT) return u != fromUnit && unitCount[u] == unitCount[fromUnit];   // a unit only swaps with one its size
  return true;
}
void loadMapUnits() {
  rowCount = 0; for (byte u = 0; u < unitTotal && rowCount < MAX_ROWS; u++) if (mapListed(u)) row[rowCount++] = u;
  if (stage == ST_FROM && rowCount + 4 <= MAX_ROWS) { row[rowCount++] = ROW_PHONE; row[rowCount++] = ROW_RECENT; row[rowCount++] = ROW_SYNC; row[rowCount++] = ROW_PIN; }
}
void countThings(byte u) {                       // how many kinds sit on each shelf of unit u
  memset(thingCount, 0, sizeof(thingCount));
  long pos = 0, next;
  while ((next = readLine(kindsFile, pos)) >= 0) { if (findUnit(field[K_UNIT]) == u) { byte lo = spaceLo(u, atoi(field[K_SHELF])); if (lo <= 16) thingCount[lo]++; } pos = next; }
}
void loadUnitRows() {                            // the unit from the side, top first: boards and empty grooves
  rowCount = 0;
  for (byte n = unitCount[viewUnit]; n >= 1 && rowCount < MAX_ROWS; n--) row[rowCount++] = hasBoard(viewUnit, n) ? n : ROW_GROOVE + n;
  if (stage == ST_FROM) row[rowCount++] = ROW_SWAP_UNIT;                       // last: the big change sits at the bottom
}
void loadActions() {
  rowCount = 0;
  if (stage == ST_TO) { row[rowCount++] = A_TOGETHER; row[rowCount++] = A_SWAP; return; }
  if (thingCount[fromLo]) { row[rowCount++] = A_OPEN; row[rowCount++] = A_MOVEALL; }
  if (fromLo > 1) row[rowCount++] = A_REMOVE;
}
// the lights while choosing: green = what is being moved, blue = where the cursor is, orange = an empty groove
void preview() {
  if (mode != MAP && mode != UNITVIEW && mode != ACTIONS) return;
  strip.clear();
  bool moving = stage == ST_TO;
  if (moving && moveWhat == W_SHELF) addSpace(fromUnit, fromLo, LIGHT_ITEM);
  if (moving && moveWhat == W_UNIT) addLights(unitFirst[fromUnit], unitCount[fromUnit], LIGHT_ITEM);
  if (moving && moveWhat == W_ITEM) { loadKind(currentKind); addPlace(field[K_UNIT], atoi(field[K_SHELF]), LIGHT_ITEM); }
  if (mode == MAP && rowCount && row[cursor] < ROW_PHONE) { byte u = row[cursor]; addLights(unitFirst[u], unitCount[u], moving ? LIGHT_NEW_SPOT : LIGHT_UNIT); }
  if (mode == UNITVIEW && rowCount) {
    byte r = row[cursor];
    if (r == ROW_SWAP_UNIT) addLights(unitFirst[viewUnit], unitCount[viewUnit], LIGHT_UNIT);
    else if (r > ROW_GROOVE) addLights(unitFirst[viewUnit] + r - ROW_GROOVE - 1, 1, LIGHT_GROOVE);
    else addSpace(viewUnit, r, moving ? LIGHT_NEW_SPOT : LIGHT_SHELF);
  }
  if (mode == ACTIONS) { if (stage == ST_FROM) addSpace(fromUnit, fromLo, LIGHT_SHELF); else addSpace(moveToUnit, moveToShelf, LIGHT_NEW_SPOT); }
  strip.show();
}
void reload() {                                 // rebuild the list for the screen we are (back) on
  if (mode == TYPES) loadTypes();
  else if (mode == KINDS) loadKinds();
  else if (mode == RESULTS) loadResults();
  else if (mode == SHELF) loadShelf();
  else if (mode == PUTAWAY) rowCount = listCount;
  else if (mode == MAP) loadMapUnits();
  else if (mode == RECENT) loadRecent();
  else if (mode == SYNC) syncPages = countSyncPages();
  else if (mode == UNITVIEW) { countThings(viewUnit); loadUnitRows(); }
  else if (mode == ACTIONS) { countThings(stage == ST_FROM ? fromUnit : moveToUnit); loadActions(); }
}
bool looksLikeCode(const char* s) {             // a scan nobody knows: no spaces and at least 5 letters/digits with a digit in it
  byte n = 0; bool digit = false;
  for (; *s; s++) { if (*s == ' ') return false; if (isdigit(*s)) digit = true; n++; }
  return n >= 5 && digit;
}

// ============================== Screens ==============================
byte firstVisibleRow() { return cursor < ROWS_ON_SCREEN ? 0 : cursor - ROWS_ON_SCREEN + 1; }    // the list scrolls so the cursor stays on screen

void drawTyping() {                             // the bottom bar while someone types
  tft.fillRect(0, 294, 480, 26, PANEL);
  char buf[48]; snprintf_P(buf, sizeof(buf), PSTR("Find: %s_   Enter = open"), query);
  text(14, 312, buf, ACCENT, SMALL);
}

void doneFooter() {                              // after a change: say it is saved, and what to do by hand
  if (doneNote == 1) footer(F("Done. Saved on the card."));
  else if (doneNote == 2) footer(F("Done. Now swap the two unit bodies."));
  else if (doneNote == 3) footer(F("Undone. Saved on the card."));
  else footer(F("Done. Saved on the card."));
  doneNote = 0;
}
void drawHomeBar() {                            // the grey bar; Down past the last picture lands on it and it opens the move screens
  if (homeCursor < 8) { footer(F("Pick a picture, type a name, or scan something")); return; }
  tft.fillRect(0, 294, 480, 26, PICKED); tft.fillRect(0, 294, 5, 26, ACCENT);
  textF(14, 312, F("Select: move things or change shelves"), WHITE, SMALL);
}
void drawHome() {
  header("IDeATe Lending", "What do you need?");
  for (byte i = 0; i < 8; i++) {
    int x = 12 + (i % 4) * 116, y = 46 + (i / 4) * 120;
    bool on = i == homeCursor;
    tft.fillRect(x, y, 108, 112, on ? PICKED : PANEL);
    tft.fillRect(x, y, 108, 6, CAT_COLOR[i]);
    if (on) { tft.drawRect(x, y, 108, 112, ACCENT); tft.drawRect(x + 1, y + 1, 106, 110, ACCENT); }
    icon(i, x + 54, y + 50, CAT_COLOR[i]);
    char name[12]; strcpy_P(name, CAT_NAME[i]);
    useFont(SMALL); text(x + 54 - textWidth(name) / 2, y + 98, name, WHITE, SMALL);
  }
  drawHomeBar();
}

// one row of a list: a bold line and a grey line under it
void drawRow(byte slot, bool on, const char* top, const char* under, int dotColor) {
  int y = 44 + slot * 50;
  tft.fillRect(0, y, 480, 48, on ? PICKED : BG);
  if (on) tft.fillRect(0, y, 5, 48, ACCENT);
  int x = 18;
  if (dotColor >= 0) { uint32_t c = LIST_RGB[dotColor]; tft.fillCircle(30, y + 24, 10, RGB((c >> 16) & 255, (c >> 8) & 255, c & 255)); x = 52; }
  text(x, y + 20, top, WHITE, BOLD, 470 - x);
  text(x, y + 40, under, DIM, SMALL, 470 - x);
}
// the rows of whichever list is showing, 5 at a time, keeping the cursor on screen
void drawRows() {
  byte first = firstVisibleRow();
  for (byte s = 0; s < ROWS_ON_SCREEN; s++) {
    byte i = first + s;
    if (i >= rowCount) { tft.fillRect(0, 44 + s * 50, 480, 48, BG); continue; }
    char top[60], under[60];
    if (mode == TYPES) {
      File f = SD.open("TYPES.TSV"); readLine(f, row[i]); f.close();
      copyText(top, field[1], sizeof(top));
      int n = atoi(field[2]); snprintf_P(under, sizeof(under), n == 1 ? PSTR("1 kind") : PSTR("%d kinds"), n);
      drawRow(s, i == cursor, top, under, -1);
    } else if (mode == UNITVIEW) {
      byte r = row[i];
      if (r == ROW_SWAP_UNIT) { strcpy_P(top, PSTR("Swap this whole unit")); strcpy_P(under, PSTR("its things trade places with a unit its size")); }
      else if (r > ROW_GROOVE) {
        byte n = r - ROW_GROOVE;
        snprintf_P(top, sizeof(top), stage == ST_TO ? PSTR("+ New shelf here (groove %d)") : PSTR("+ Add a shelf board at groove %d"), n);
        snprintf_P(under, sizeof(under), PSTR("now part of shelf %d's tall space"), spaceLo(viewUnit, n));
      } else {
        byte hi = spaceHi(viewUnit, r);
        if (hi > r) snprintf_P(top, sizeof(top), PSTR("Shelf %d   (tall: lights %d to %d)"), r, r, hi); else snprintf_P(top, sizeof(top), PSTR("Shelf %d"), r);
        byte n = r <= 16 ? thingCount[r] : 0;
        if (!n) strcpy_P(under, PSTR("empty")); else snprintf_P(under, sizeof(under), n == 1 ? PSTR("1 thing") : PSTR("%d things"), n);
      }
      drawRow(s, i == cursor, top, under, -1);
    } else if (mode == RECENT) {
      if (row[i] == ROW_UNDO) { strcpy_P(top, PSTR("Undo the last change")); strcpy_P(under, PSTR("takes back the newest one below")); }
      else describeChange(row[i], top, sizeof(top), under, sizeof(under));
      drawRow(s, i == cursor, top, under, -1);
    } else if (mode == ACTIONS) {
      byte a = row[i];
      if (a == A_OPEN) { strcpy_P(top, PSTR("See what is on it")); strcpy_P(under, PSTR("open one thing to move just that")); }
      else if (a == A_MOVEALL) { strcpy_P(top, PSTR("Move everything on it")); snprintf_P(under, sizeof(under), PSTR("%d things go to another shelf together"), thingCount[fromLo]); }
      else if (a == A_REMOVE) { strcpy_P(top, PSTR("Take this shelf board out")); snprintf_P(under, sizeof(under), PSTR("for something tall: it joins shelf %d below"), spaceLo(fromUnit, fromLo - 1)); }
      else if (a == A_TOGETHER) { snprintf_P(top, sizeof(top), PSTR("Put them together on shelf %d"), moveToShelf); strcpy_P(under, PSTR("both groups share that shelf")); }
      else { strcpy_P(top, PSTR("Swap the two shelves")); strcpy_P(under, PSTR("each group goes where the other one was")); }
      drawRow(s, i == cursor, top, under, -1);
    } else if (mode == PUTAWAY) {
      loadKind(listKind[i]);
      copyText(top, field[K_NAME], sizeof(top));
      char where[40], blink[8]; whereText(where, sizeof(where)); strcpy_P(blink, BLINK_NAME[listColor[i]]);
      if (listLed[i] >= 0 && LIST_BLINKS) snprintf_P(under, sizeof(under), PSTR("%s  -  %s light"), where, blink); else strcpy(under, where);
      drawRow(s, i == cursor, top, under, listLed[i] >= 0 ? listColor[i] : -1);
    } else {
      loadKind(row[i]);
      copyText(top, field[K_NAME], sizeof(top));
      if (mode == KINDS && field[K_WHAT][0]) copyText(under, field[K_WHAT], sizeof(under));
      else whereText(under, sizeof(under));
      drawRow(s, i == cursor, top, under, -1);
    }
  }
}
void drawList() {
  char right[16]; snprintf_P(right, sizeof(right), PSTR("%d of %d"), rowCount ? cursor + 1 : 0, rowCount);
  char title[40];
  if (mode == TYPES) strcpy_P(title, CAT_NAME[currentCat]);
  else if (mode == KINDS) copyText(title, typeName, sizeof(title));
  else if (mode == RESULTS) snprintf_P(title, sizeof(title), PSTR("\"%s\""), query);
  else if (mode == UNITVIEW) { if (stage == ST_TO) snprintf_P(title, sizeof(title), PSTR("%s: which shelf?"), unitName[viewUnit]); else copyText(title, unitName[viewUnit], sizeof(title)); }
  else if (mode == RECENT) strcpy_P(title, PSTR("Recent changes"));
  else if (mode == ACTIONS) { if (stage == ST_TO) snprintf_P(title, sizeof(title), PSTR("Shelf %d has things on it"), moveToShelf); else snprintf_P(title, sizeof(title), PSTR("%s, shelf %d"), unitName[fromUnit], fromLo); }
  else if (mode == SHELF) { int u = findUnit(shelfUnit); snprintf_P(title, sizeof(title), PSTR("%s, shelf %d"), u >= 0 ? unitName[u] : shelfUnit, shelfNumber); }
  else strcpy_P(title, PSTR("Put these away"));
  if (rowCount == 0) right[0] = '\0';
  header(title, right);
  drawRows();                                    // (first, so the "nothing here" line is not painted over)
  if (rowCount == 0) {
    if (mode == RESULTS && looksLikeCode(query)) textF(18, 90, F("This barcode is not in the list. Ask at the desk."), DIM, SMALL);
    else if (mode == ACTIONS) textF(18, 90, F("The bottom shelf is empty. Nothing to change here."), DIM, SMALL);
    else if (mode == RECENT) textF(18, 90, F("No changes since the laptop last collected them."), DIM, SMALL);
    else textF(18, 90, mode == RESULTS ? F("Nothing matches. Try another word.") : F("Nothing here."), DIM, SMALL);
  }
  if (mode == PUTAWAY) footer(F("Scan the next thing.  Back = done, lights off"));
  else if (justChanged) { justChanged = false; doneFooter(); }
  else if (mode == UNITVIEW && stage == ST_TO) footer(F("Up / Down, Select = put it here"));
  else if (mode == UNITVIEW) footer(F("Select a shelf, or a groove to add a board"));
  else if (mode == ACTIONS) footer(F("Up / Down, Select.   Back"));
  else if (mode == RECENT) { char used[48]; snprintf_P(used, sizeof(used), PSTR("Newest first.   Room for %d more changes"), MAX_MOVES - moveTotal); tft.fillRect(0, 294, 480, 26, PANEL); text(14, 312, used, moveTotal > MAX_MOVES - 20 ? ACCENT : DIM, SMALL); }
  else footer(F("Up / Down to move    Select to open    Back"));
}

// the item's name: big if it fits, then smaller, then on two lines (some names are long)
void drawItemName(const char* name) {
  const int W = 452;
  useFont(TITLE); if (textWidth(name) <= W) { text(14, 62, name, WHITE, TITLE, W); return; }
  useFont(BOLD);  if (textWidth(name) <= W) { text(14, 62, name, WHITE, BOLD, W); return; }
  char first[60]; copyText(first, name, sizeof(first));
  int cut = -1;                                                  // the last space that keeps the first line inside the width
  for (int i = 0; first[i]; i++) if (first[i] == ' ') { first[i] = '\0'; if (textWidth(first) <= W) cut = i; first[i] = ' '; }
  if (cut < 0) { text(14, 62, name, WHITE, BOLD, W); return; }
  first[cut] = '\0';
  text(14, 50, first, WHITE, BOLD, W); text(14, 71, name + cut + 1, WHITE, BOLD, W);
}
// the QR on the item page: nameCode() turns the item's name into the 6 letters the website looks for
bool drawQRText(int x, int y, const char* url) {   // a version-4 QR (up to 62 letters), 4 screen pixels a dot, white border
  QRCode qr;
  if (qrcode_initText(&qr, qrData, 4, ECC_MEDIUM, url) != 0) return false;
  const int PX = 4, QUIET = 3, SIDE = (33 + 2 * QUIET) * PX;
  tft.fillRect(x, y, SIDE, SIDE, WHITE);
  for (byte dotY = 0; dotY < qr.size; dotY++) {
    byte dotX = 0;
    while (dotX < qr.size) {                                        // draw each run of dark dots as one rectangle: much faster
      if (!qrcode_getModule(&qr, dotX, dotY)) { dotX++; continue; }
      byte run = dotX; while (run < qr.size && qrcode_getModule(&qr, run, dotY)) run++;
      tft.fillRect(x + (QUIET + dotX) * PX, y + (QUIET + dotY) * PX, (run - dotX) * PX, PX, BLACK);
      dotX = run;
    }
  }
  return true;
}
void drawQR(int x, int y) {                     // the item's guide page
  char url[80]; strcpy_P(url, MANUAL_URL);
  byte n = strlen(url); snprintf_P(url + n, sizeof(url) - n, PSTR("%06lx"), nameCode(field[K_NAME]));
  if (!drawQRText(x, y, url)) { textF(x, y + 40, F("Ask at the desk"), WHITE, SMALL); return; }
  textF(x + 6, y + 156 + 22, F("Scan for the guide"), DIM, SMALL);
}
void drawItem() {
  loadKind(currentKind);
  char buf[64];
  byte cat = constrain(atoi(field[K_CAT]), 0, 7);
  const int LEFT_W = 286;                                         // the left column; the QR takes the right
  tft.fillScreen(BG);
  tft.fillRect(0, 0, 480, 6, CAT_COLOR[cat]);
  char catName[12]; strcpy_P(catName, CAT_NAME[cat]);
  snprintf_P(buf, sizeof(buf), PSTR("%s  -  %s"), catName, field[K_TYPE]);
  text(14, 28, buf, DIM, SMALL, 280);
  int copies = atoi(field[K_COPIES]);
  if (copies > 1) { snprintf_P(buf, sizeof(buf), PSTR("Lending has %d"), copies); rightText(buf); }
  drawItemName(field[K_NAME]);
  int led = ledFor(field[K_UNIT], atoi(field[K_SHELF]));
  whereText(buf, sizeof(buf));
  char kept[40] = "";                                             // no light: "Ask at the desk" big, the place it is kept under it
  if (led < 0) { char* open = strchr(buf, '('); if (open) { snprintf_P(kept, sizeof(kept), PSTR("Kept in: %s"), open + 1); kept[strlen(kept) - 1] = '\0'; *(open - 1) = '\0'; } }
  tft.fillRect(14, 82, LEFT_W, 70, led >= 0 ? GREEN : PANEL);
  Font f = HUGE_FONT;                                             // the biggest letters that fit
  useFont(f); if (textWidth(buf) > LEFT_W - 28) { f = TITLE; useFont(f); }
  if (textWidth(buf) > LEFT_W - 28) f = BOLD;
  text(28, 116, buf, led >= 0 ? BLACK : WHITE, f, LEFT_W - 28);
  if (led >= 0) textF(28, 142, F("Its shelf is lit green in the room"), BLACK, SMALL);
  else if (kept[0]) text(28, 142, kept, DIM, SMALL, LEFT_W - 28);
  else textF(28, 142, F("Not on the shelves in this room"), DIM, SMALL);
  int y = 180;                                                    // the two notes stack under the shelf, each as long as it needs
  if (field[K_WHAT][0]) { textF(14, y, F("What it is"), DIM, SMALL); y += 22; y += 20 * paragraph(14, y, field[K_WHAT], WHITE, LEFT_W, 3) + 16; }
  if (field[K_GOOD][0]) { textF(14, y, F("Good for"), DIM, SMALL); y += 22; paragraph(14, y, field[K_GOOD], WHITE, LEFT_W, (284 - y) / 20 + 1); }
  drawQR(312, 82);
  if (justMoved) { justMoved = false; footer(F("Moved. Its new spot is saved on the card.")); }
  else if (justAdded) { justAdded = false; footer(F("Added. It is saved on the card.")); }
  else footer(itemWasScanned ? F("Down: move it     Scan more: a list") : F("Down: move it     Back"));
  strip.clear(); addPlace(field[K_UNIT], atoi(field[K_SHELF]), LIGHT_ITEM); strip.show();
}

// ---- the map: the room from above, the unit under the cursor filled in
const int MAP_X = 14, MAP_Y = 48;
const uint16_t NEW_BLUE = RGB(0, 80, 255);
void mapBox(byte u, uint16_t fill, uint16_t edge) {
  if (unitMap[u][0] == 255) return;
  int x0 = MAP_X + unitMap[u][0] * 36 / 25, y0 = MAP_Y + unitMap[u][1] * 36 / 25;          // room mm / 2, times 1.44 = screen pixels
  int x1 = MAP_X + unitMap[u][2] * 36 / 25, y1 = MAP_Y + unitMap[u][3] * 36 / 25;
  int w = x1 - x0 < 8 ? 8 : x1 - x0, h = y1 - y0 < 8 ? 8 : y1 - y0;
  tft.fillRect(x0, y0, w, h, fill);
  if (edge != fill) { tft.drawRect(x0, y0, w, h, edge); tft.drawRect(x0 + 1, y0 + 1, w - 2, h - 2, edge); }
}
void drawMapBody() {
  tft.fillRect(MAP_X, MAP_Y, 288, 216, RGB(36, 52, 98));                   // the blue floor, 400 x 300 mm
  const uint16_t WOOD = RGB(205, 178, 130), OFF = RGB(80, 86, 100);
  for (byte u = 0; u < unitTotal; u++) mapBox(u, mapListed(u) ? WOOD : OFF, RGB(120, 100, 70));
  if (stage == ST_TO) {
    int h = fromUnit;
    if (moveWhat == W_ITEM) { loadKind(currentKind); h = findUnit(field[K_UNIT]); }
    if (h >= 0) mapBox(h, GREEN, GREEN);
  }
  tft.fillRect(310, 44, 170, 240, BG);
  if (!rowCount) { textF(316, 72, F("No unit fits"), DIM, SMALL); return; }
  byte u = row[cursor];
  char right[16]; snprintf_P(right, sizeof(right), PSTR("%d of %d"), cursor + 1, rowCount);
  tft.fillRect(360, 8, 120, 30, BG); rightText(right);
  if (u == ROW_PHONE) {                                         // the staff page as a QR: scan it with a phone to make move codes
    tft.fillRect(MAP_X, MAP_Y, 288, 216, PANEL);
    char url[56]; strcpy_P(url, STAFF_URL);
    drawQRText(MAP_X + 66, MAP_Y + 30, url);
    textF(316, 72, F("Staff page"), WHITE, BOLD);
    textF(316, 100, F("Scan with a phone"), DIM, SMALL); textF(316, 124, F("to move things,"), DIM, SMALL);
    textF(316, 148, F("move shelves or"), DIM, SMALL); textF(316, 172, F("add a new item."), DIM, SMALL);
    textF(316, 208, F("Then scan its code"), DIM, SMALL); textF(316, 232, F("it makes, here."), DIM, SMALL);
    return;
  }
  if (u >= ROW_RECENT) {                                        // the last three spots are not units: a card over the map says what Select does
    tft.fillRect(MAP_X, MAP_Y, 288, 216, PANEL);
    const __FlashStringHelper *title, *l1, *l2, *l3;
    if (u == ROW_RECENT) { title = F("Recent changes"); l1 = F("Every change made here,"); l2 = F("newest first."); l3 = F("Undo the last one here."); }
    else if (u == ROW_SYNC) { title = F("Send to website"); l1 = F("Shows the changes as QR"); l2 = F("codes. Scan them on the"); l3 = F("website's staff page."); }
    else { title = F("Change staff PIN"); l1 = F("Pick a new 4-digit PIN."); l2 = F("It is asked before every"); l3 = F("change to the room."); }
    textF(MAP_X + 16, MAP_Y + 44, title, WHITE, BOLD);
    textF(MAP_X + 16, MAP_Y + 86, l1, DIM, SMALL); textF(MAP_X + 16, MAP_Y + 110, l2, DIM, SMALL); textF(MAP_X + 16, MAP_Y + 134, l3, DIM, SMALL);
    textF(316, 72, F("Select:"), WHITE, BOLD); textF(316, 96, u == ROW_RECENT ? F("see the list") : u == ROW_SYNC ? F("show the codes") : F("set a new PIN"), DIM, SMALL);
    return;
  }
  mapBox(u, ACCENT, WHITE);
  text(316, 72, unitName[u], WHITE, BOLD, 156);
  char buf[32];
  if (unitCount[u]) {
    byte shelves = 0; for (byte n = 1; n <= unitCount[u]; n++) if (hasBoard(u, n)) shelves++;
    snprintf_P(buf, sizeof(buf), shelves == 1 ? PSTR("%d shelf, %d light%s") : PSTR("%d shelves, %d light%s"), shelves, unitCount[u], unitCount[u] == 1 ? "" : "s"); text(316, 96, buf, DIM, SMALL, 156);
  } else textF(316, 96, F("No lights"), DIM, SMALL);
  if (unitMap[u][0] == 255) { textF(316, 120, F("Not on the map:"), DIM, SMALL); textF(316, 140, F("a room or area"), DIM, SMALL); }
  int ly = unitMap[u][0] == 255 ? 190 : 150;                     // below the "not on the map" lines when they are there
  if (stage == ST_TO) { tft.fillRect(316, ly, 12, 12, GREEN); textF(334, ly + 11, F("now"), DIM, SMALL); tft.fillRect(316, ly + 22, 12, 12, ACCENT); textF(334, ly + 33, F("goes here"), DIM, SMALL); }
  else if (unitCount[u]) textF(316, ly + 11, F("Its lights are on"), DIM, SMALL);
}
void drawMap() {
  const char* t = "Which unit?";
  if (stage == ST_TO) t = moveWhat == W_UNIT ? "Swap with which unit?" : moveWhat == W_SHELF ? "Move the shelf to which unit?" : "Move it to which unit?";
  header(t, NULL);
  textF(MAP_X, 284, F("console side"), DIM, SMALL);
  drawMapBody();
  if (justChanged) { justChanged = false; doneFooter(); }
  else if (stage == ST_TO) footer(F("Up / Down = next unit, Select = this one"));
  else footer(F("Up / Down = next unit, Select = open it.  Back"));
}

// ---- "Move it?": what changes, the old spot lit green and the new one blue
bool atMoveTarget() {                           // is the change already true? (the thing or shelf is already there)
  if (moveWhat == W_SHELF) return moveToUnit == fromUnit && moveToShelf == fromLo && !toNewBoard;
  if (moveWhat != W_ITEM) return false;
  loadKind(currentKind);
  int u = findUnit(field[K_UNIT]); if (u != moveToUnit) return false;
  if (!unitCount[u]) return true;
  return !toNewBoard && spaceLo(u, atoi(field[K_SHELF])) == moveToShelf;
}
void placeText(char* out, byte size, byte u, byte shelf) {
  if (!unitCount[u]) snprintf_P(out, size, PSTR("Ask at the desk (%s)"), unitName[u]);
  else if (toNewBoard) snprintf_P(out, size, PSTR("%s, new shelf %d"), unitName[u], shelf);
  else snprintf_P(out, size, PSTR("%s, shelf %d"), unitName[u], shelf);
}
void drawMoveOK() {
  char from[48], to[48], note[64];
  bool same = atMoveTarget();
  strip.clear();
  const char* title = "Move it?";
  if (moveWhat == W_ITEM) {
    loadKind(currentKind); whereText(from, sizeof(from)); addPlace(field[K_UNIT], atoi(field[K_SHELF]), LIGHT_ITEM);
    placeText(to, sizeof(to), moveToUnit, moveToShelf);
    strcpy_P(note, PSTR("Every copy moves."));
  } else if (moveWhat == W_SHELF) {
    title = swapShelves ? "Swap the two shelves?" : "Move the whole shelf?";
    snprintf_P(from, sizeof(from), PSTR("%s, shelf %d"), unitName[fromUnit], fromLo); addSpace(fromUnit, fromLo, LIGHT_ITEM);
    placeText(to, sizeof(to), moveToUnit, moveToShelf);
    snprintf_P(note, sizeof(note), swapShelves ? PSTR("Its %d things go there, the things there come here.") : PSTR("All %d things on it move."), fromCount);
  } else if (moveWhat == W_UNIT) {
    title = "Swap the two units?";
    copyText(from, unitName[fromUnit], sizeof(from)); copyText(to, unitName[moveToUnit], sizeof(to));
    addLights(unitFirst[fromUnit], unitCount[fromUnit], LIGHT_ITEM);
    strcpy_P(note, PSTR("Each keeps its name and things. Swap the bodies too."));
  } else if (moveWhat == W_ADDBOARD) {
    title = "Add a shelf board?";
    byte lo = spaceLo(fromUnit, fromLo);
    snprintf_P(from, sizeof(from), PSTR("%s, shelf %d (tall)"), unitName[fromUnit], lo); addSpace(fromUnit, lo, LIGHT_ITEM);
    snprintf_P(to, sizeof(to), PSTR("a board at groove %d"), fromLo);
    strcpy_P(note, PSTR("Slide the board in first. Things below it stay put."));
  } else {
    title = "Take this board out?";
    byte below = spaceLo(fromUnit, fromLo - 1);
    snprintf_P(from, sizeof(from), PSTR("%s, shelf %d"), unitName[fromUnit], fromLo); addSpace(fromUnit, fromLo, LIGHT_ITEM);
    snprintf_P(to, sizeof(to), PSTR("joins shelf %d below"), below);
    if (fromCount) snprintf_P(note, sizeof(note), PSTR("Its %d things will be on shelf %d."), fromCount, below);
    else snprintf_P(note, sizeof(note), PSTR("Shelf %d becomes one tall space."), below);
  }
  header(same ? "Already here" : title, NULL);
  if (moveWhat == W_ITEM) { loadKind(currentKind); text(14, 70, field[K_NAME], WHITE, BOLD, 452); }
  if (same) {
    tft.fillRect(14, 96, 452, 60, GREEN); text(28, 134, to, BLACK, BOLD, 424);
    textF(14, 190, F("This is already its spot. Nothing to change."), DIM, SMALL);
    footer(F("Back"));
  } else {
    tft.fillRect(14, 86, 452, 56, PANEL); tft.fillRect(14, 86, 6, 56, GREEN);
    textF(30, 106, F("Now"), DIM, SMALL); text(30, 130, from, WHITE, BOLD, 430);
    tft.fillRect(14, 150, 452, 56, PANEL); tft.fillRect(14, 150, 6, 56, NEW_BLUE);
    textF(30, 170, moveWhat == W_UNIT ? F("Swaps with") : F("New"), DIM, SMALL); text(30, 194, to, ACCENT, BOLD, 430);
    text(14, 232, note, DIM, SMALL, 452);
    textF(14, 256, F("Green = now. Blue = new."), DIM, SMALL);
    footer(F("Select = do it      Back = cancel"));
  }
  if (moveWhat == W_UNIT) addLights(unitFirst[moveToUnit], unitCount[moveToUnit], LIGHT_NEW_SPOT);
  else if (moveWhat == W_ADDBOARD) addLights(unitFirst[fromUnit] + fromLo - 1, 1, LIGHT_NEW_SPOT);
  else if (moveWhat == W_DELBOARD) addSpace(fromUnit, spaceLo(fromUnit, fromLo - 1), LIGHT_NEW_SPOT);
  else if (unitCount[moveToUnit] && !same) {
    if (toNewBoard) addLights(unitFirst[moveToUnit] + moveToShelf - 1, 1, LIGHT_NEW_SPOT);
    else addSpace(moveToUnit, moveToShelf, LIGHT_NEW_SPOT);
  } else if (same && unitCount[moveToUnit]) addSpace(moveToUnit, moveToShelf, LIGHT_ITEM);
  strip.show();
}

// ---- the staff PIN: 4 boxes. Type the digits, or Up / Down to change a digit and Select for the next one
void drawPin() {
  header(pinStep == P_ENTER ? "Staff PIN" : pinStep == P_NEW1 ? "New staff PIN" : "New PIN again", NULL);
  if (pinStep == P_ENTER) textF(14, 72, F("Changes to the room need the staff PIN."), DIM, SMALL);
  else textF(14, 72, pinStep == P_NEW1 ? F("Pick 4 digits. Faculty can change it any time.") : F("Type the same 4 digits again."), DIM, SMALL);
  for (byte i = 0; i < 4; i++) {
    int x = 120 + i * 64;
    bool now = i == pinLen;
    tft.fillRect(x, 100, 52, 64, now ? PICKED : PANEL);
    if (now) tft.fillRect(x, 160, 52, 4, ACCENT);
    char d[2] = {0, 0};
    if (i < pinLen) { tft.fillCircle(x + 26, 132, 8, WHITE); }
    else if (now) { d[0] = '0' + pinDigit; text(x + 18, 144, d, ACCENT, BOLD); }
  }
  if (pinWrong) textF(14, 200, F("Wrong PIN. Try again."), RGB(255, 110, 100), BOLD);
  else if (pinMismatch) textF(14, 200, F("Those were not the same. Start again."), RGB(255, 110, 100), BOLD);
  textF(14, 240, F("Keyboard: type the digits.  Buttons: Up / Down"), DIM, SMALL);
  textF(14, 262, F("change the digit, Select takes it."), DIM, SMALL);
  footer(F("Back = cancel"));
}

// ---- a new item from the phone: 3 short steps
void drawAddNew() {
  char right[12]; snprintf_P(right, sizeof(right), PSTR("%d of 3"), addStep);
  header(addStep == 1 ? "New item" : addStep == 2 ? "Its barcode" : "Where it goes", right);
  char buf[64];
  strip.clear();
  if (addStep == 1) {
    text(14, 78, addName, WHITE, BOLD, 452);
    char cat[12]; strcpy_P(cat, CAT_NAME[addCat]);
    snprintf_P(buf, sizeof(buf), PSTR("%s - %s"), cat, addType); text(14, 108, buf, DIM, SMALL, 452);
    snprintf_P(buf, sizeof(buf), addCopies == 1 ? PSTR("%d copy") : PSTR("%d copies"), addCopies); text(14, 134, buf, DIM, SMALL, 452);
    placeText(buf, sizeof(buf), addUnit, addShelf); textF(14, 160, F("Goes to"), DIM, SMALL); text(80, 160, buf, WHITE, SMALL, 386);
    textF(14, 210, F("Check it matches the phone, then Select."), DIM, SMALL);
    footer(F("Select = next      Back = cancel"));
  } else if (addStep == 2) {
    textF(14, 80, F("Scan the barcode or QR sticker"), WHITE, BOLD);
    textF(14, 106, F("that is on the new item."), WHITE, BOLD);
    if (addProblem[0]) text(14, 160, addProblem, RGB(255, 110, 100), SMALL, 452);
    else if (addCode[0]) { tft.fillRect(14, 140, 452, 44, GREEN); snprintf_P(buf, sizeof(buf), PSTR("Got: %s"), addCode); text(26, 168, buf, BLACK, BOLD, 428); }
    else textF(14, 160, F("No sticker yet? Select skips this step."), DIM, SMALL);
    footer(F("Select = next      Back"));
  } else {
    placeText(buf, sizeof(buf), addUnit, addShelf);
    tft.fillRect(14, 70, 452, 60, PANEL); tft.fillRect(14, 70, 6, 60, NEW_BLUE);
    text(30, 108, buf, ACCENT, BOLD, 430);
    textF(14, 160, F("Its spot is lit blue in the room."), DIM, SMALL);
    textF(14, 184, F("Another spot? Move it once it is added."), DIM, SMALL);
    footer(F("Select = save it      Back"));
    if (unitCount[addUnit]) addSpace(addUnit, addShelf, LIGHT_NEW_SPOT);
  }
  strip.show();
}

void draw() {
  if (mode == HOME) drawHome();
  else if (mode == ITEM) drawItem();
  else if (mode == MOVEOK) drawMoveOK();
  else if (mode == MAP) drawMap();
  else if (mode == PIN) drawPin();
  else if (mode == ADDNEW) drawAddNew();
  else if (mode == SYNC) drawSync();
  else drawList();
  if (queryLen) drawTyping();
}

// ============================== Put-away list ==============================
// a scanned thing: the first one shows where it lives; a second, different one starts the put-away list
void clearPutAway() { listCount = 0; rowCount = 0; }
void addToPutAway(long kind) {
  for (byte i = 0; i < listCount; i++) if (listKind[i] == kind) return;      // already on it
  if (listCount >= MAX_LIST) return;
  loadKind(kind);
  int led = ledFor(field[K_UNIT], atoi(field[K_SHELF]));
  byte color = listCount % 6;
  for (byte i = 0; i < listCount; i++) if (led >= 0 && listLed[i] == led) color = listColor[i];   // same shelf: same colour and blink
  listKind[listCount] = kind; listLed[listCount] = led; listSpan[listCount] = spanFor(field[K_UNIT], atoi(field[K_SHELF])); listColor[listCount] = color; listCount++;
}

// ============================== Going between screens ==============================
void go(byte next) {                            // open a screen, remembering where Back should return to
  if (backDepth < BACK_MAX) { backTo[backDepth] = mode; backCursor[backDepth] = cursor; backStage[backDepth] = stage; backView[backDepth] = viewUnit; backDepth++; }
  mode = next; cursor = 0;
}
void goHome() { homeMessage = false; mode = HOME; backDepth = 0; stage = ST_FROM; cursor = 0; queryLen = 0; query[0] = '\0'; live = false; livePending = false; lightsOff(); draw(); }
void openItem(long kind, bool scanned) { queryLen = 0; live = false; livePending = false; currentKind = kind; itemWasScanned = scanned; go(ITEM); draw(); }
void openResults() { backDepth = 0; mode = HOME; go(RESULTS); }          // the search screen, as the first screen after Home

void back() {
  if (mode == HOME && backDepth == 0 && !queryLen && !live && !homeMessage && homeCursor == 0) return;   // already at the start: nothing to redraw
  if (live) { live = false; livePending = false; queryLen = 0; }            // leaving a live search: forget what was typed
  if (queryLen && mode != RESULTS) { queryLen = 0; query[0] = '\0'; draw(); return; }   // first Back just clears what was typed
  if (mode == PUTAWAY) { clearPutAway(); goHome(); return; }
  if (backDepth == 0) { goHome(); return; }
  backDepth--; mode = backTo[backDepth]; byte c = backCursor[backDepth]; stage = backStage[backDepth]; viewUnit = backView[backDepth];
  if (mode == PUTAWAY && listCount == 0) { goHome(); return; }
  if (mode == HOME) { goHome(); return; }
  lightsOff();
  reload(); cursor = c < rowCount ? c : 0;
  draw(); preview();
}

// ============================== Moving things and changing shelves ==============================
void askPin(byte after);                         // (below) the staff PIN screen
// two ways in: Down on a thing's page (move that thing), or the grey bar on Home (pick a unit on the map, then a shelf)
void openMap(byte focusUnit) {                   // the map screen, cursor on focusUnit if it is in the list
  go(MAP); loadMapUnits();
  for (byte i = 0; i < rowCount; i++) if (row[i] == focusUnit) cursor = i;
  draw(); preview();
}
void openUnit(byte u) {                          // the side view of one unit
  viewUnit = u; go(UNITVIEW); countThings(u); loadUnitRows();
  draw(); preview();
}
void startMove() {                              // from a thing's page: pick a unit on the map, then a shelf, then say yes
  loadKind(currentKind);
  int here = findUnit(field[K_UNIT]);
  moveFromDepth = backDepth; moveWhat = W_ITEM; stage = ST_TO; toNewBoard = false;
  openMap(here >= 0 ? here : 0);
}
void startOrganize() {                         // from the grey bar on Home: start on the first unit on the map
  byte first = 0; while (first < unitTotal && (unitMap[first][0] == 255 || !unitCount[first])) first++;
  moveWhat = W_ITEM; stage = ST_FROM; backDepth = 0; mode = HOME; openMap(first < unitTotal ? first : 0);
}
void pickedUnit(byte u) {                       // Select on the map
  if (u == ROW_PHONE) return;                                                  // only a QR to look at
  if (u == ROW_RECENT) { go(RECENT); loadRecent(); draw(); lightsOff(); return; }
  if (u == ROW_SYNC) { go(SYNC); syncPage = 0; syncPages = countSyncPages(); draw(); lightsOff(); return; }
  if (u == ROW_PIN) { pinAfter = AFTER_NOTHING; pinStep = P_NEW1; pinLen = 0; pinDigit = 0; pinWrong = false; pinMismatch = false; go(PIN); draw(); lightsOff(); return; }
  if (stage == ST_FROM) { openUnit(u); return; }
  moveToUnit = u; toNewBoard = false;
  if (moveWhat == W_UNIT) { go(MOVEOK); draw(); return; }
  if (unitCount[u] == 0) { moveToShelf = 0; go(MOVEOK); draw(); return; }      // a place with no lights has no shelves to pick
  openUnit(u);
  if (moveWhat == W_ITEM) {                                                     // start on the shelf it is on now, if it is this unit
    loadKind(currentKind);
    if (findUnit(field[K_UNIT]) == u) { byte lo = spaceLo(u, atoi(field[K_SHELF])); for (byte i = 0; i < rowCount; i++) if (row[i] == lo) cursor = i; }
    draw(); preview();
  }
}
void pickedRow(byte r) {                         // Select on the side view
  if (stage == ST_FROM) {
    fromUnit = viewUnit;
    if (r == ROW_SWAP_UNIT) { moveWhat = W_UNIT; stage = ST_TO; openMap(viewUnit); return; }
    if (r > ROW_GROOVE) { moveWhat = W_ADDBOARD; fromLo = r - ROW_GROOVE; go(MOVEOK); draw(); return; }
    fromLo = r; fromHi = spaceHi(viewUnit, r); fromCount = thingCount[r];
    go(ACTIONS); loadActions(); draw(); preview(); return;
  }
  moveToUnit = viewUnit; toNewBoard = r > ROW_GROOVE; moveToShelf = toNewBoard ? r - ROW_GROOVE : r; swapShelves = false;
  if (moveWhat == W_SHELF && !toNewBoard && !atMoveTarget() && thingCount[moveToShelf]) { go(ACTIONS); loadActions(); draw(); preview(); return; }   // somebody lives there: together or swap?
  go(MOVEOK); draw();
}
void pickedAction(byte a) {
  if (a == A_OPEN) { strcpy(shelfUnit, unitCode[fromUnit]); shelfNumber = fromLo; go(SHELF); loadShelf(); draw(); lightsOff(); addSpace(fromUnit, fromLo, LIGHT_SHELF); strip.show(); return; }
  if (a == A_MOVEALL) { moveWhat = W_SHELF; stage = ST_TO; openMap(fromUnit); return; }
  if (a == A_REMOVE) { moveWhat = W_DELBOARD; go(MOVEOK); draw(); return; }
  swapShelves = a == A_SWAP; go(MOVEOK); draw();
}
bool saveOrSay(char type, const byte* a, unsigned long key) {     // writes one change, or says why it could not
  if (!moveListHasRoom(type, key)) { header("Move list is full", NULL); textF(18, 90, F("The console holds 128 changes. The laptop must"), WHITE, SMALL); textF(18, 114, F("collect them now: apply_moves.py, send the new"), WHITE, SMALL); textF(18, 138, F("files, then type @CLEARMOVES."), WHITE, SMALL); footer(F("Back")); return false; }
  if (!saveChange(type, a)) { header("Could not save", NULL); textF(18, 90, F("The SD card would not write. Is it locked?"), WHITE, SMALL); footer(F("Back")); return false; }
  rememberChange(type, a);
  return true;
}
bool setBoard(byte u, byte n, bool on, bool withS) {     // also adds a B line to MOVES.TSV (history, undo, website)
  uint16_t was = unitBoards[u];
  if (on) unitBoards[u] |= (1 << (n - 1)); else unitBoards[u] &= ~(1 << (n - 1));
  byte b[6] = {u, n, (byte)on, (byte)withS, 0, 0};
  if (saveBoards()) { saveChange('B', b); return true; }
  unitBoards[u] = was; header("Could not save", NULL); textF(18, 90, F("The SD card would not write. Is it locked?"), WHITE, SMALL); footer(F("Back"));
  return false;
}
void showDone(byte u) {                          // after a change: the map, then the unit that changed, saying "Done"
  backDepth = 0; mode = HOME; stage = ST_FROM;
  go(MAP); loadMapUnits(); for (byte i = 0; i < rowCount; i++) if (row[i] == u) cursor = i;
  openUnit(u); justChanged = true; draw(); preview();
}
void doMove() {
  if (!staffOK()) { askPin(AFTER_DOMOVE); return; }
  staffUntil = millis() + STAFF_MS;
  if (moveWhat == W_ITEM) {
    loadKind(currentKind);
    unsigned long key = nameCode(field[K_NAME]);
    byte a[6] = {(byte)((key >> 16) & 255), (byte)((key >> 8) & 255), (byte)(key & 255), moveToUnit, moveToShelf, 0};
    if (!moveListHasRoom('I', key)) { saveOrSay('I', a, key); return; }
    if (toNewBoard && !setBoard(moveToUnit, moveToShelf, true, false)) return;
    if (!saveOrSay('I', a, key)) return;
    backDepth = moveFromDepth; mode = ITEM; stage = ST_FROM; justMoved = true; draw(); return;
  }
  byte a[6] = {fromUnit, fromLo, fromHi, moveToUnit, moveToShelf, 0};
  if (moveWhat == W_SHELF) {
    if (!moveListHasRoom('S', 0)) { saveOrSay('S', a, 0); return; }
    if (toNewBoard && !setBoard(moveToUnit, moveToShelf, true, false)) return;
    fromHi = spaceHi(fromUnit, fromLo);                                          // the shelf being moved, as it is now
    a[2] = fromHi;
    if (swapShelves) { a[5] = spaceHi(moveToUnit, moveToShelf); if (!saveOrSay('X', a, 0)) return; }
    else if (!saveOrSay('S', a, 0)) return;
    doneNote = 1; showDone(moveToUnit); return;
  }
  if (moveWhat == W_UNIT) {                                                     // only a line in the file: units are swapped when the file is read
    a[1] = moveToUnit;
    if (!saveChange('U', a)) { header("Could not save", NULL); textF(18, 90, F("The SD card would not write. Is it locked?"), WHITE, SMALL); footer(F("Back")); return; }
    swapUnits(fromUnit, moveToUnit); doneNote = 2; showDone(moveToUnit); return;
  }
  if (moveWhat == W_ADDBOARD) { if (setBoard(fromUnit, fromLo, true, false)) showDone(fromUnit); return; }
  // W_DELBOARD: the things on it now sit on the shelf below
  byte below = spaceLo(fromUnit, fromLo - 1);
  if (fromCount) { a[1] = fromLo; a[2] = spaceHi(fromUnit, fromLo); a[3] = fromUnit; a[4] = below; if (!saveOrSay('S', a, 0)) return; }
  if (!setBoard(fromUnit, fromLo, false, fromCount > 0)) return;
  showDone(fromUnit);
}


// ============================== The staff PIN, phone QR codes, new items ==============================
void askPin(byte after) {                        // open the PIN screen; `after` runs once it is right
  pinAfter = after; pinStep = P_ENTER; pinLen = 0; pinDigit = 0; pinWrong = false; pinMismatch = false;
  go(PIN); draw(); lightsOff();
}
void popScreen() {                               // leave the PIN screen without drawing (the next step draws)
  if (backDepth) { backDepth--; mode = backTo[backDepth]; cursor = backCursor[backDepth]; stage = backStage[backDepth]; viewUnit = backView[backDepth]; }
  else mode = HOME;
}
void runCode(char* c);
void pinDone() {                                 // 4 digits are in
  pinIn[4] = '\0';
  if (pinStep == P_ENTER) {
    if (strcmp(pinIn, staffPin) != 0) { pinWrong = true; pinLen = 0; pinDigit = 0; draw(); return; }
    staffUntil = millis() + STAFF_MS;
    popScreen();
    if (pinAfter == AFTER_ORGANIZE) startOrganize();
    else if (pinAfter == AFTER_MOVE) startMove();
    else if (pinAfter == AFTER_CODE) runCode(pendingCode);
    else if (pinAfter == AFTER_DOMOVE) doMove();
    else draw();
    return;
  }
  if (pinStep == P_NEW1) { strcpy(pinNew, pinIn); pinStep = P_NEW2; pinLen = 0; pinDigit = 0; pinMismatch = false; draw(); return; }
  if (strcmp(pinIn, pinNew) != 0) { pinStep = P_NEW1; pinLen = 0; pinDigit = 0; pinMismatch = true; draw(); return; }
  char was[5]; strcpy(was, staffPin); strcpy(staffPin, pinNew);
  if (!saveStaff()) { strcpy(staffPin, was); header("Could not save", NULL); textF(18, 90, F("The SD card would not write. Is it locked?"), WHITE, SMALL); footer(F("Back")); return; }
  popScreen(); justChanged = true; reload(); draw(); preview();
}
void pinKey(char d) {                            // one digit, from the keyboard or from Select
  if (pinLen >= 4) return;
  pinWrong = false;
  pinIn[pinLen++] = d; pinDigit = 0;
  if (pinLen == 4) pinDone(); else draw();
}
// "AUD-3" -> unit and shelf. false = not a real place
bool parsePlace(const char* t, byte* u, byte* shelf) {
  const char* dash = strrchr(t, '-');
  if (!dash || dash - t > 4) return false;
  char code[5]; memcpy(code, t, dash - t); code[dash - t] = '\0';
  int i = findUnit(code); if (i < 0) return false;
  int n = atoi(dash + 1);
  if (unitCount[i] == 0) { *u = i; *shelf = 0; return true; }
  if (n < 1 || n > unitCount[i]) return false;
  *u = i; *shelf = n; return true;
}
void codeProblem(const __FlashStringHelper* what) {      // a phone code that cannot be used
  backDepth = 0; mode = HOME; homeMessage = true;
  header("Phone code not used", NULL); textF(18, 90, what, WHITE, SMALL);
  textF(18, 130, F("Nothing was changed. Make a new code on the"), DIM, SMALL); textF(18, 154, F("website and scan it again."), DIM, SMALL);
  footer(F("Any button = Home"));
}
// RL:MOVE:<code6>:<UNIT>-<shelf>    RL:SHELF:<UNIT>-<shelf>:<UNIT>-<shelf>[:SWAP]    RL:ADD:<type>|<UNIT>-<shelf>|<copies>|<name>
void runCode(char* c) {
  c += 3;
  if (strncasecmp_P(c, PSTR("MOVE:"), 5) == 0) {
    char* place = strchr(c + 5, ':'); if (!place) { codeProblem(F("The code is not complete.")); return; }
    *place++ = '\0';
    long kind = findNameCode(strtoul(c + 5, NULL, 16));
    if (kind < 0) { codeProblem(F("That item is not in this console's list.")); return; }
    byte u, sh; if (!parsePlace(place, &u, &sh)) { codeProblem(F("That unit or shelf does not exist here.")); return; }
    backDepth = 0; mode = HOME; currentKind = kind; moveFromDepth = 0;
    moveWhat = W_ITEM; stage = ST_TO; toNewBoard = false; moveToUnit = u; moveToShelf = unitCount[u] ? spaceLo(u, sh) : 0;
    go(MOVEOK); draw(); return;
  }
  if (strncasecmp_P(c, PSTR("SHELF:"), 6) == 0) {
    char* a = c + 6; char* b = strchr(a, ':'); if (!b) { codeProblem(F("The code is not complete.")); return; }
    *b++ = '\0'; char* swap = strchr(b, ':'); if (swap) *swap++ = '\0';
    byte u1, s1, u2, s2;
    if (!parsePlace(a, &u1, &s1) || !parsePlace(b, &u2, &s2) || !unitCount[u1] || !unitCount[u2]) { codeProblem(F("That unit or shelf does not exist here.")); return; }
    fromUnit = u1; fromLo = spaceLo(u1, s1); fromHi = spaceHi(u1, fromLo);
    countThings(u1); fromCount = thingCount[fromLo];
    if (!fromCount) { codeProblem(F("That shelf is empty: nothing to move.")); return; }
    moveToUnit = u2; moveToShelf = spaceLo(u2, s2); toNewBoard = false;
    swapShelves = swap && strcasecmp_P(swap, PSTR("SWAP")) == 0;
    backDepth = 0; mode = HOME; moveWhat = W_SHELF; stage = ST_TO;
    go(MOVEOK); draw(); return;
  }
  if (strncasecmp_P(c, PSTR("ADD:"), 4) == 0) {
    char* part[4]; byte n = 0; char* p = c + 4;
    while (n < 4) { part[n++] = p; if (n == 4) break; p = strchr(p, '|'); if (!p) break; *p++ = '\0'; }
    if (n < 4 || !part[3][0]) { codeProblem(F("The code is not complete.")); return; }
    int t = atoi(part[0]);
    File f = SD.open("TYPES.TSV"); long pos = 0; bool found = false;
    for (int i = 0; f && (pos = readLine(f, pos)) >= 0; i++) if (i == t) { found = true; break; }
    if (f) f.close();
    if (!found || !field[1][0]) { codeProblem(F("That type is not in this console's list.")); return; }
    addCat = atoi(field[0]); copyText(addType, field[1], sizeof(addType));
    if (!parsePlace(part[1], &addUnit, &addShelf)) { codeProblem(F("That unit or shelf does not exist here.")); return; }
    if (addShelf) addShelf = spaceLo(addUnit, addShelf);
    addCopies = atoi(part[2]) < 1 ? 1 : atoi(part[2]);
    copyText(addName, part[3], sizeof(addName));
    if (findName(addName) >= 0) { codeProblem(F("An item with that name is already in the list.")); return; }
    addCode[0] = '\0'; addProblem[0] = '\0'; addStep = 1; toNewBoard = false;
    backDepth = 0; mode = HOME; go(ADDNEW); draw(); return;
  }
  codeProblem(F("The console does not know this kind of code."));
}
void addScanned(char* t) {                       // a scan while a new item is being set up
  if (strncasecmp_P(t, PSTR("LOC:"), 4) == 0) {
    byte u, sh; if (!parsePlace(t + 4, &u, &sh)) return;
    addUnit = u; addShelf = unitCount[u] ? spaceLo(u, sh) : 0; addStep = 3; draw(); return;
  }
  if (addStep != 2) return;
  addProblem[0] = '\0';
  long k = findCode(t);
  if (k >= 0) { loadKind(k); snprintf_P(addProblem, sizeof(addProblem), PSTR("That code is already on: %s"), field[K_NAME]); draw(); return; }
  copyText(addCode, t, sizeof(addCode)); draw();
}
void saveNewItem() {                             // adds one line to the end of KINDS.TSV (and its barcode to CODES.TSV)
  if (!staffOK()) { askPin(AFTER_NOTHING); return; }
  kindsFile.close();
  File f = SD.open("KINDS.TSV", FILE_WRITE);
  long pos = f ? (long)f.size() : -1;
  bool ok = f;
  if (f) {
    char buf[110];
    snprintf_P(buf, sizeof(buf), PSTR("%d\t%s\t%s\t%s\t%d\t%d\t\t"), addCat, addType, addName, unitCode[addUnit], addShelf, addCopies);
    for (char* q = buf; *q; q++) f.write((byte)*q);
    f.write((byte)'\n'); f.close();
  }
  kindsFile = SD.open("KINDS.TSV");
  if (ok && addCode[0]) {
    File c = SD.open("CODES.TSV", FILE_WRITE);
    if (c) { char buf[56]; snprintf_P(buf, sizeof(buf), PSTR("%s\t%ld"), addCode, pos); for (char* q = buf; *q; q++) c.write((byte)*q); c.write((byte)'\n'); c.close(); } else ok = false;
  }
  if (!ok) { header("Could not save", NULL); textF(18, 90, F("The SD card would not write. Is it locked?"), WHITE, SMALL); footer(F("Back")); return; }
  File m = SD.open("MOVES.TSV", FILE_WRITE);                                   // history line: shows in Recent changes and goes to the website
  if (m) { char buf[110]; snprintf_P(buf, sizeof(buf), PSTR("A\t%d\t%s\t%s\t%s\t%d\t%d"), addCat, addType, addName, unitCode[addUnit], addShelf, addCopies); m.println(buf); m.close(); }
  staffUntil = millis() + STAFF_MS;
  backDepth = 0; mode = HOME; justAdded = true; openItem(pos, false);
  strip.clear(); addPlace(unitCode[addUnit], addShelf, LIGHT_ITEM); strip.show();
}


// ============================== Recent changes, Undo, and the website QR pages ==============================
// every change is one line of MOVES.TSV (see the top). Recent changes lists them newest first; Undo takes the last line back.
long lastLine(long* before) {                    // where the last line of MOVES.TSV starts (-1 = empty); *before = the one before it
  File f = SD.open("MOVES.TSV"); long pos = 0, next, last = -1; *before = -1;
  while (f && (next = readLine(f, pos)) >= 0) { if (field[0][0]) { *before = last; last = pos; } pos = next; }
  if (f) f.close();
  return last;
}
void loadRecent() {                              // newest first, after the Undo row
  rowCount = 0;
  long before, last = lastLine(&before);
  if (last >= 0) row[rowCount++] = ROW_UNDO;
  File f = SD.open("MOVES.TSV"); long pos = 0, next; byte n = 0;
  long ring[MAX_ROWS - 1];
  while (f && (next = readLine(f, pos)) >= 0) { if (field[0][0]) { ring[n % (MAX_ROWS - 1)] = pos; n++; } pos = next; }
  if (f) f.close();
  byte have = n < MAX_ROWS - 1 ? n : MAX_ROWS - 1;
  for (byte i = 0; i < have; i++) row[rowCount++] = ring[(n - 1 - i) % (MAX_ROWS - 1)];
}
void describeChange(long pos, char* top, byte topSize, char* under, byte underSize) {   // one MOVES.TSV line in plain words
  File f = SD.open("MOVES.TSV"); readLine(f, pos); f.close();
  char t = field[0][1] ? 'I' : toupper(field[0][0]);
  int u1 = findUnit(field[1]);
  const char* n1 = u1 >= 0 ? unitName[u1] : field[1];
  under[0] = '\0';
  if (t == 'B') { snprintf_P(top, topSize, atoi(field[3]) ? PSTR("Board put in: %s, groove %s") : PSTR("Board taken out: %s, groove %s"), n1, field[2]); if (field[4][0]) strcpy_P(under, PSTR("its things went to the shelf below")); }
  else if (t == 'A') { snprintf_P(top, topSize, PSTR("Added: %s"), field[3]); int u = findUnit(field[4]); snprintf_P(under, underSize, PSTR("%s, shelf %s"), u >= 0 ? unitName[u] : field[4], field[5]); }
  else if (t == 'U') { int u2 = findUnit(field[2]); snprintf_P(top, topSize, PSTR("%s and %s traded places"), n1, u2 >= 0 ? unitName[u2] : field[2]); }
  else if (t == 'S' || t == 'X') {
    char a[24], b[24]; int u2 = findUnit(field[4]);
    snprintf_P(a, sizeof(a), PSTR("%s %s"), n1, field[2]); snprintf_P(b, sizeof(b), PSTR("%s %s"), u2 >= 0 ? unitName[u2] : field[4], field[5]);
    snprintf_P(top, topSize, t == 'X' ? PSTR("Shelves swapped: %s, %s") : PSTR("Shelf moved: %s to %s"), a, b);
  } else {
    char where[28]; int u = findUnit(field[1]);
    if (u >= 0 && unitCount[u]) snprintf_P(where, sizeof(where), PSTR("%s, shelf %s"), unitName[u], field[2]); else copyText(where, u >= 0 ? unitName[u] : field[1], sizeof(where));
    long k = findNameCode(strtoul(field[0], NULL, 16));
    if (k >= 0) { loadKind(k); copyText(top, field[K_NAME], topSize); } else strcpy_P(top, PSTR("A thing"));
    snprintf_P(under, underSize, PSTR("moved to %s"), where);
  }
}
bool copyFile(const char* from, const char* to, long upTo) {     // the first upTo bytes of one file into another (Arduino SD has no rename)
  File a = SD.open(from); SD.remove(to); File b = SD.open(to, FILE_WRITE);
  if (!a || !b) { if (a) a.close(); if (b) b.close(); return false; }
  for (long i = 0; i < upTo && a.available(); i++) b.write((byte)a.read());
  a.close(); b.close(); return true;
}
void reloadData() { loadUnits(); loadBoards(); loadMoves(); }   // after an undo: everything as if the console had just started
void undoLast() {                                // takes the last change back
  if (!staffOK()) { askPin(AFTER_NOTHING); return; }
  long before, last = lastLine(&before);
  if (last < 0) return;
  File f = SD.open("MOVES.TSV"); readLine(f, last); f.close();
  char t = field[0][1] ? 'I' : toupper(field[0][0]);
  if (t == 'A') { header("Can't undo adding", NULL); textF(18, 90, F("A new item stays until the laptop removes it."), WHITE, SMALL); textF(18, 114, F("Move it, or ask the laptop to take it out."), DIM, SMALL); footer(F("Back")); return; }
  long cut = last;
  if (t == 'B') {
    int u = findUnit(field[1]); byte n = atoi(field[2]); bool was = atoi(field[3]), withS = field[4][0];
    if (u >= 0) { if (was) unitBoards[u] &= ~(1 << (n - 1)); else unitBoards[u] |= (1 << (n - 1)); saveBoards(); }
    if (withS && before >= 0) cut = before;                        // the things that dropped down go back up too
  }
  bool ok = cut == 0 ? SD.remove("MOVES.TSV") : (copyFile("MOVES.TSV", "MOVES.TMP", cut) && copyFile("MOVES.TMP", "MOVES.TSV", cut));
  SD.remove("MOVES.TMP");
  if (!ok) { header("Could not save", NULL); textF(18, 90, F("The SD card would not write. Is it locked?"), WHITE, SMALL); footer(F("Back")); return; }
  staffUntil = millis() + STAFF_MS;
  reloadData(); loadRecent(); cursor = 0; justChanged = true; doneNote = 3; draw(); lightsOff();
}
// ---- the website QR pages: MOVES.TSV, a few lines per QR, tabs written as |
const byte SYNC_BYTES = 150;                    // letters of the change list per QR page (plus the page header)
byte countSyncPages() {
  File f = SD.open("MOVES.TSV"); long pos = 0, next; int used = 0; byte pages = 1;
  while (f && (next = readLine(f, pos)) >= 0) { int len = next - pos; if (used + len > SYNC_BYTES) { pages++; used = 0; } used += len; pos = next; }
  if (f) f.close();
  return pages;
}
void drawSync() {
  char right[16]; snprintf_P(right, sizeof(right), PSTR("%d of %d"), syncPage + 1, syncPages);
  header("To the website", right);
  char qtext[SYNC_BYTES + 40]; int len = 0, lines = 0, first = -1, total = 0, used = 0; byte page = 0;
  File f = SD.open("MOVES.TSV"); long pos = 0, next;
  while (f && (next = readLine(f, pos)) >= 0) total++, pos = next;                // how many lines, all pages
  pos = 0;
  len = snprintf_P(qtext, sizeof(qtext), PSTR("RLSYNC|%d|%d|%d\n"), syncPage + 1, syncPages, total);
  int index = 0;
  while (f && (next = readLine(f, pos)) >= 0) {
    int n = next - pos;
    if (used + n > SYNC_BYTES) { page++; used = 0; }
    used += n;
    if (page == syncPage && len + n < (int)sizeof(qtext)) {
      if (first < 0) first = index;
      f.seek(pos); for (int i = 0; i < n; i++) { char c = f.read(); if (c == '\r') continue; qtext[len++] = c == '\t' ? '|' : c; }
      lines++;
    }
    pos = next; index++;
  }
  if (f) f.close();
  qtext[len] = '\0';
  if (!total) { textF(18, 90, F("No changes yet. Nothing to send."), WHITE, SMALL); footer(F("Back")); return; }
  QRCode qr;
  if (qrcode_initText(&qr, qrData, SYNC_QR, ECC_LOW, qtext) != 0) { textF(18, 90, F("Too much for one code."), WHITE, SMALL); footer(F("Back")); return; }
  const int PX = 4, QUIET = 4, SIDE = (qr.size + 2 * QUIET) * PX, X = 14, Y = 50;
  tft.fillRect(X, Y, SIDE, SIDE, WHITE);
  for (byte dy = 0; dy < qr.size; dy++) { byte dx = 0; while (dx < qr.size) { if (!qrcode_getModule(&qr, dx, dy)) { dx++; continue; } byte r = dx; while (r < qr.size && qrcode_getModule(&qr, r, dy)) r++; tft.fillRect(X + (QUIET + dx) * PX, Y + (QUIET + dy) * PX, (r - dx) * PX, PX, BLACK); dx = r; } }
  char buf[40];
  textF(276, 72, F("On the phone, open"), WHITE, SMALL); textF(276, 94, F("the staff page, tab"), WHITE, SMALL); textF(276, 116, F("\"From the console\"."), WHITE, SMALL);
  snprintf_P(buf, sizeof(buf), PSTR("Changes %d to %d of %d"), first + 1, first + lines, total); text(276, 156, buf, DIM, SMALL, 196);
  textF(276, 178, F("Scan every page."), DIM, SMALL);
  footer(syncPages > 1 ? F("Up / Down = next page     Back") : F("Back"));
}

// ============================== Buttons ==============================
void moveCursor(byte b) {                       // Up or Down in a list
  byte firstBefore = firstVisibleRow();
  cursor = b == B_UP ? (cursor + rowCount - 1) % rowCount : (cursor + 1) % rowCount;
  if (mode == MAP) { drawMapBody(); preview(); return; }
  if (firstVisibleRow() != firstBefore) { draw(); preview(); return; }
  preview();
  drawRows();                                                  // same page: only the rows change, no flicker
  char right[16]; snprintf_P(right, sizeof(right), PSTR("%d of %d"), cursor + 1, rowCount);
  tft.fillRect(360, 8, 120, 30, BG); rightText(right);
}
void pressed(byte b) {                          // Up, Down, Select or Back, from a button, the keyboard or the laptop
  lastActivity = millis();
  if (mode == ADDNEW && b == B_BACK && addStep > 1) { addStep--; addProblem[0] = '\0'; draw(); return; }
  if (mode == PIN && b == B_BACK && pinLen > 0) { pinLen--; pinDigit = 0; draw(); return; }
  if (b == B_BACK) { back(); return; }
  if (mode == PIN) {
    if (b == B_UP) pinDigit = (pinDigit + 1) % 10;
    if (b == B_DOWN) pinDigit = (pinDigit + 9) % 10;
    if (b == B_SELECT) { pinKey('0' + pinDigit); return; }
    draw(); return;
  }
  if (mode == SYNC) { if (b == B_DOWN && syncPage + 1 < syncPages) syncPage++; else if (b == B_UP && syncPage > 0) syncPage--; else return; draw(); return; }
  if (mode == ADDNEW) { if (b == B_SELECT) { if (addStep < 3) { addStep++; addProblem[0] = '\0'; draw(); } else saveNewItem(); } return; }
  if (mode == HOME) {
    if (homeMessage) { homeMessage = false; draw(); return; }
    if (b == B_UP) homeCursor = (homeCursor + 8) % 9;              // 9 spots: the 8 pictures, then the grey bar
    if (b == B_DOWN) homeCursor = (homeCursor + 1) % 9;
    if (b == B_SELECT) { if (homeCursor == 8) { if (staffOK()) startOrganize(); else askPin(AFTER_ORGANIZE); return; } currentCat = homeCursor; go(TYPES); loadTypes(); }
    draw(); return;
  }
  if (mode == ITEM) { if (b == B_DOWN) { if (staffOK()) startMove(); else askPin(AFTER_MOVE); } return; }   // Down: move it (staff PIN first)
  if (mode == MOVEOK) { if (b == B_SELECT) { if (atMoveTarget()) back(); else doMove(); } return; }
  if (rowCount == 0) return;
  if (b == B_UP || b == B_DOWN) { moveCursor(b); return; }
  if (mode == TYPES) { currentType = row[cursor]; go(KINDS); loadKinds(); draw(); }
  else if (mode == MAP) pickedUnit(row[cursor]);
  else if (mode == UNITVIEW) pickedRow(row[cursor]);
  else if (mode == ACTIONS) pickedAction(row[cursor]);
  else if (mode == RECENT) { if (row[cursor] == ROW_UNDO) undoLast(); }
  else if (mode == PUTAWAY) openItem(listKind[cursor], false);
  else openItem(row[cursor], false);
}

// ============================== Scans and typing ==============================
void scannedKind(long kind) {
  if (mode == PUTAWAY) { addToPutAway(kind); }
  else if (mode == ITEM && itemWasScanned && kind != currentKind) { clearPutAway(); addToPutAway(currentKind); addToPutAway(kind); backDepth = 0; mode = PUTAWAY; }
  else { backDepth = 0; mode = HOME; openItem(kind, true); return; }
  rowCount = listCount; cursor = listCount - 1;
  draw();
}
// a shelf label, like LOC:AUD-3. With an item open it says where the item goes; otherwise it shows what is on that shelf
void scannedShelf(char* label) {
  char* dash = strrchr(label, '-');
  if (!dash) return;
  *dash = '\0';
  char unit[5]; copyText(unit, label + 4, sizeof(unit)); byte shelf = atoi(dash + 1);
  int u = findUnit(unit);
  bool movingThing = mode == ITEM || ((mode == MAP || mode == UNITVIEW) && stage == ST_TO && moveWhat == W_ITEM);
  if (movingThing) {                                                            // a thing is open: the label says where it goes (or checks it)
    if (u < 0 || (unitCount[u] && (shelf < 1 || shelf > unitCount[u]))) return;   // not a real place: ignore it, the move carries on
    if (mode == ITEM) { moveFromDepth = backDepth; moveWhat = W_ITEM; }
    stage = ST_TO; toNewBoard = false;
    moveToUnit = u; moveToShelf = unitCount[u] ? spaceLo(u, shelf) : 0; go(MOVEOK); draw();
    return;
  }
  strcpy(shelfUnit, unit); shelfNumber = u >= 0 && shelf >= 1 && shelf <= unitCount[u] ? spaceLo(u, shelf) : shelf;
  backDepth = 0; mode = HOME; stage = ST_FROM; go(SHELF); loadShelf();
  draw(); strip.clear(); addPlace(shelfUnit, shelfNumber, LIGHT_SHELF); strip.show();
}
// everything that arrives as text ends up here: a scan, a typed search, or a line from the laptop
void entered(char* textIn) {
  lastActivity = millis();
  while (*textIn == ' ') textIn++;
  if (!*textIn) return;
  if (strcasecmp_P(textIn, PSTR("CLEAR")) == 0) { clearPutAway(); homeCursor = 0; goHome(); return; }
  if (mode == PIN) return;                                                      // scans wait while the PIN is typed
  if (mode == ADDNEW) { addScanned(textIn); return; }
  if (strncasecmp_P(textIn, PSTR("RL:"), 3) == 0) {                            // a code made on the website's staff page
    queryLen = 0; query[0] = '\0';
    if (staffOK()) runCode(textIn);
    else { copyText(pendingCode, textIn, sizeof(pendingCode)); askPin(AFTER_CODE); }
    return;
  }
  if (strncasecmp_P(textIn, PSTR("LOC:"), 4) == 0 && strrchr(textIn, '-')) { scannedShelf(textIn); return; }
  long kind = findCode(textIn);
  if (kind >= 0) { queryLen = 0; query[0] = '\0'; scannedKind(kind); return; }
  copyText(query, textIn, sizeof(query)); queryLen = 0; live = false; livePending = false;      // not a barcode: search for it
  if (mode == PUTAWAY) clearPutAway();
  openResults(); loadResults();
  if (rowCount == 1) { mode = HOME; backDepth = 0; openItem(row[0], false); return; }
  draw();
}
void liveSearch() {                              // show what matches the letters typed so far
  if (mode == PUTAWAY) clearPutAway();
  if (!live) { openResults(); live = true; }
  loadResults(); cursor = 0; draw();
}
void typed(byte c) {                            // one key from the keyboard
  lastActivity = millis();
  if (c == 0x7F) c = 0x08;                                       // some keyboards send DEL (0x7F) for the delete key: treat it as backspace
  if (c == 0x1B) { pressed(B_BACK); return; }                    // Esc works like the Back button
  if (mode == ADDNEW) { if (c == 0x0D || c == 0x0A) pressed(B_SELECT); else if (c == 0x08) pressed(B_BACK); return; }
  if (mode == PIN) {                                             // the keyboard types the PIN
    if (c >= '0' && c <= '9') pinKey(c);
    else if (c == 0x08) pressed(B_BACK);
    return;
  }
  if (c == 0x0D || c == 0x0A) {
    if (queryLen == 0) { pressed(B_SELECT); return; }
    if (live && mode == RESULTS && rowCount > 0) { openItem(row[cursor], false); return; }   // Enter opens the highlighted result
    char sent[32]; strcpy(sent, query); entered(sent); return;
  }
  if (c == 0x08) { if (!queryLen) { if (live) back(); return; }               // nothing typed: nothing to delete
    query[--queryLen] = '\0'; if (!queryLen) { if (live) back(); else draw(); return; } liveAt = millis(); livePending = true; }
  else if (c >= 32 && c < 127) {                                 // a letter, digit or symbol
    if (queryLen >= sizeof(query) - 1) return;                   // the search box is full
    query[queryLen++] = c; query[queryLen] = '\0'; liveAt = millis(); livePending = true;
  }
  else { Serial.print(F("Unknown key 0x")); Serial.println(c, HEX); return; }     // so a key's code can be looked up in the Serial Monitor
  drawTyping();
}

// ============================== Reading the inputs ==============================
void readButtons() {
  static byte last[BUTTON_COUNT] = {HIGH, HIGH, HIGH, HIGH};
  static unsigned long repeatAt[BUTTON_COUNT];
  static byte heldOn[BUTTON_COUNT];                                          // the screen a button was first pressed on
  for (byte b = 0; b < BUTTON_COUNT; b++) {
    byte now = digitalRead(BUTTON_PIN[b]);
    if (now != last[b]) { delay(15); now = digitalRead(BUTTON_PIN[b]); }      // wait out the bounce
    if (last[b] == HIGH && now == LOW) { heldOn[b] = mode; repeatAt[b] = millis() + HOLD_DELAY; pressed(b); }
    else if (now == LOW && (b == B_UP || b == B_DOWN) && mode == heldOn[b] && millis() >= repeatAt[b]) {
      repeatAt[b] = millis() + HOLD_REPEAT; pressed(b);                       // held down: Up and Down keep scrolling
    }
    last[b] = now;
  }
}
void readScanner() {
  static char buf[72]; static byte len = 0; static unsigned long lastChar = 0;
  static char lastCode[72] = ""; static unsigned long lastCodeAt = 0;
  bool done = false;
  while (Serial1.available()) {
    char c = Serial1.read(); lastChar = millis();
    if (c == '\r' || c == '\n') { done = true; break; }
    if (len < sizeof(buf) - 1) buf[len++] = c;
  }
  if (len && (done || millis() - lastChar > 80)) {
    buf[len] = '\0'; len = 0;
    if (strcmp(buf, lastCode) == 0 && millis() - lastCodeAt < 2000) { lastCodeAt = millis(); return; }   // the same code held in view
    strcpy(lastCode, buf); lastCodeAt = millis();
    entered(buf);
  }
}
void readKeyboard() {
  static unsigned long lastPoll = 0;
  if (millis() - lastPoll < 25) return;
  lastPoll = millis();
  if (Wire.requestFrom(KEYBOARD_ADDR, (byte)1) != 1) return;
  byte c = Wire.read();
  if (c) typed(c);
}
// the laptop can send a file for the SD card:  @PUT NAME SIZE  then the bytes, 60 at a time, waiting for K each time
void receiveFile(char* args) {
  char* sp = strchr(args, ' ');
  if (!sp) { Serial.println(F("@ERR usage")); return; }
  *sp = '\0'; long size = atol(sp + 1);
  if (!strstr_P(args, PSTR(".TSV")) || strlen(args) > 12) { Serial.println(F("@ERR only .TSV files")); return; }
  bool wasKinds = strcasecmp_P(args, PSTR("KINDS.TSV")) == 0;
  if (wasKinds) kindsFile.close();
  header("Receiving from laptop", NULL); text(18, 90, args, WHITE, BOLD);
  File f = SD.open(args, O_WRITE | O_CREAT | O_TRUNC);
  if (!f) { Serial.println(F("@ERR cannot write")); return; }
  long got = 0; byte sinceAck = 0; unsigned long lastByte = millis();
  Serial.println(F("K"));
  while (got < size && millis() - lastByte < 5000) {
    if (!Serial.available()) continue;
    f.write((byte)Serial.read()); got++; lastByte = millis();
    if (++sinceAck >= 60 && got < size) { sinceAck = 0; Serial.println(F("K")); }
  }
  f.close();
  if (wasKinds) kindsFile = SD.open("KINDS.TSV");
  if (got == size) { Serial.print(F("@OK ")); Serial.println(got); } else Serial.println(F("@ERR timeout"));
  loadUnits(); loadBoards(); loadMoves(); loadStaff(); findAddedFrom(); goHome();
}
void readLaptop() {                              // a line of text from the Serial Monitor or the laptop tools
  static char buf[64]; static byte len = 0;
  while (Serial.available()) {
    char c = Serial.read();
    if (c != '\n' && c != '\r') { if (len < sizeof(buf) - 1) buf[len++] = c; continue; }
    buf[len] = '\0'; len = 0;
    if (!buf[0]) continue;
    if (strncasecmp_P(buf, PSTR("@PUT "), 5) == 0) { receiveFile(buf + 5); return; }
    if (strcasecmp_P(buf, PSTR("@MOVES")) == 0) {                    // print every move done at the desk, for the spreadsheet
      File f = SD.open("MOVES.TSV"); while (f && f.available()) Serial.write(f.read()); if (f) f.close();
      Serial.println(F("@END")); continue;
    }
    if (strcasecmp_P(buf, PSTR("@ADDED")) == 0) {                    // items added at the console, then their barcodes
      long pos = addedFrom, next;
      while (addedFrom > 0 && (next = readLine(kindsFile, pos)) >= 0) {
        kindsFile.seek(pos); for (long i = pos; i < next; i++) Serial.write(kindsFile.read()); pos = next;
      }
      Serial.println(F("@CODES"));
      File f = SD.open("CODES.TSV"); long p = 0;
      while (f && (p = readLine(f, p)) >= 0) if (addedFrom > 0 && atol(field[1]) >= addedFrom) { Serial.print(field[0]); Serial.print('\t'); Serial.println(field[1]); }
      if (f) f.close();
      Serial.println(F("@END")); continue;
    }
    if (strcasecmp_P(buf, PSTR("@CLEARMOVES")) == 0) { SD.remove("MOVES.TSV"); loadUnits(); loadBoards(); loadMoves(); Serial.println(F("@OK")); goHome(); continue; }   // units that traded places go back too
    if (strcasecmp_P(buf, PSTR("@LIGHTS")) == 0) {                   // light check: every light red, then green, then blue, then all stay green until a button
      const uint32_t test[3] = {0xFF0000, 0x00FF00, 0x0000FF};
      for (byte t = 0; t < 3; t++) { strip.fill(test[t]); strip.show(); delay(1500); }
      strip.fill(0x00FF00); strip.show(); Serial.println(F("@OK")); continue;
    }
    if (buf[0] == '@') { Serial.print(F("@ROOMLOCATOR ")); Serial.println((const __FlashStringHelper*)VERSION); continue; }
    if (buf[0] == '!' && buf[1] && !buf[2]) {                    // !U !D !S !B press a button from the laptop
      const char* keys = "UDSB"; const char* k = strchr(keys, toupper(buf[1]));
      if (k) pressed(k - keys);
      continue;
    }
    entered(buf);
  }
}

// ============================== setup() and loop() ==============================
void stopWith(const __FlashStringHelper* a, const __FlashStringHelper* b) {      // a problem nobody can use the console past
  header("Room Locator", NULL); textF(18, 90, a, WHITE, BOLD); textF(18, 120, b, DIM, SMALL);
}
void setup() {
  Serial.begin(115200);
  Serial1.begin(SCANNER_BAUD);
  Wire.begin(); Wire.setWireTimeout(3000, true);
  for (byte i = 0; i < BUTTON_COUNT; i++) pinMode(BUTTON_PIN[i], INPUT_PULLUP);
  strip.begin(); strip.setBrightness(LED_BRIGHTNESS); lightsOff();
  uint16_t id = tft.readID();                                      // ask the screen chip what it is
  if (id == 0 || id == 0xFFFF || id == 0xD3D3 || id == 0x0404) id = 0x9486;   // the read wire is not connected on this shield: it is an ILI9486
  tft.begin(id); tft.setRotation(3); tft.setTextWrap(false);
  pinMode(SD_CS_PIN, OUTPUT); digitalWrite(SD_CS_PIN, HIGH);
  if (!SD.begin(SD_CS_PIN)) { stopWith(F("No SD card"), F("Push the card in and press the reset button")); while (true) {} }
  kindsFile = SD.open("KINDS.TSV");
  staffUntil = 0;                                                  // a restart locks changes again
  loadUnits(); loadBoards(); loadMoves(); loadStaff(); findAddedFrom();
  if (!kindsFile || unitTotal == 0) {                              // card without the v5 files: wait for the laptop to send them
    stopWith(F("Waiting for the laptop"), F("The SD card needs the data files (push_card.py)"));
    while (!kindsFile || unitTotal == 0) readLaptop();
  }
  for (int i = 0; i < NUM_LEDS; i++) { strip.clear(); strip.setPixelColor(i, LIGHT_SWEEP); strip.show(); delay(12); }   // sweep: every light works
  Serial.print(F("Room Locator ")); Serial.print((const __FlashStringHelper*)VERSION); Serial.println(F(" ready"));
  goHome();
}
void loop() {
  readButtons();
  readScanner();
  readKeyboard();
  readLaptop();
  blinkTick();
  if (livePending && millis() - liveAt > 350 && !Serial1.available()) { livePending = false; if (queryLen >= 2) liveSearch(); }
  if (millis() - lastActivity > IDLE_MS && (mode != HOME || homeCursor == 8)) { clearPutAway(); homeCursor = 0; goHome(); lastActivity = millis(); }
}
