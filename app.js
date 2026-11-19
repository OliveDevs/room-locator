const app = document.getElementById('app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const search = query => 'https://www.google.com/search?q=' + encodeURIComponent(query);
let DATA, K, PHOTO={}, ROOM={units:[]}, HOWTO={guides:{},items:{}}, KITS=[];
const MODEL_CHOICES={
  'Scarlett 2i2 Audio Interface':{hint:'The generation is printed on the device or can be identified by the front panel and serial number.',options:[['1st generation','https://downloads.focusrite.com/focusrite/scarlett-1st-gen/scarlett-2i2-1st-gen'],['2nd generation','https://downloads.focusrite.com/focusrite/scarlett-2nd-gen/scarlett-2i2-2nd-gen'],['3rd generation','https://downloads.focusrite.com/focusrite/scarlett-3rd-gen/scarlett-2i2-3rd-gen'],['4th generation','https://userguides.focusrite.com/hc/en-gb/sections/19640363031570-Scarlett-2i2-4th-Gen-User-Guide']]},
  'Audio Mixer ProFX16':{hint:'Look for ProFX16v2 or ProFX16v3 on the mixer label.',options:[['ProFX16v2 (video walkthrough)','https://www.youtube.com/watch?v=AdtaAadMUl4'],['ProFX16v3','https://mackie.com/en/products/accessories/ProFX16v3.html']]},
  'Fostex 6301 Powered Speakers':{hint:'Look at the rear label for the complete suffix, such as 6301N. Different suffixes have different inputs.',options:[['6301N series','https://www.fostex.jp/cms/wp-content/uploads/6301N_Manual_EN72-1.pdf'],['Another 6301 version','https://www.fostex.jp/en/support/manual/']]},
  'Alesis Multimix4 4-Channel Mixer':{hint:'Use this guide only if the faceplate says MultiMix 4 USB FX.',options:[['MultiMix 4 USB FX','https://www.alesis.com/products/view/multimix-4-usb-fx']]}
};
const TIPS={
  'Measuring Tape - 16\'':['The small movement in the end hook compensates for measuring from an outside edge versus pushing against an inside surface. Do not bend it tight.','Keep the blade straight and read the mark square on to avoid parallax. Mark a small V with its point at the measurement.','For an inside span, measure from both ends toward a clear reference if the tape case makes the final inch hard to read. Record the unit and measure twice.'],
  'Digital Caliper':['Close the jaws gently and zero the display before measuring.','Use the large jaws for outside dimensions, small jaws for inside dimensions, and depth rod for holes or recesses.','Do not squeeze soft parts; pressure can change the reading.'],
  'Behringer S16 Digital Stage Box':['AES50 uses an Ethernet-style connector, but it is not a normal network connection. Connect only to compatible AES50 equipment.'],
  'Scarlett 2i2 Audio Interface':['For a microphone, use the mic input and enable 48V only if that microphone requires phantom power. For a guitar, select instrument input.'],
  'Photo & Video/Tripods':['Keep one leg under a heavy camera or lens when aiming downward. Check the quick-release plate is locked before stepping away.'],
  'Soft Tech/Sewing Machines':['Raise the presser foot before threading the upper path so thread can seat between the tension discs. Test tension on scrap from the same fabric.'],
  'Audio/Field Recorders':['Watch the level meter for peaks and listen with headphones. A meter can show signal while wind or handling noise ruins the take.'],
  'Lighting/Projectors':['Set the projector square to the screen before using keystone correction; this preserves more of the image resolution.']
};
const INTRO={
  'Audio/Accessories':'An audio accessory for connecting, positioning, or controlling a recording setup. Match its connector or mounting size to the main device.',
  'Audio/Cables':'An audio cable for connecting a source to a recorder, mixer, amplifier, or speaker. Check the plug on both ends and the signal type.',
  'Audio/Cassette Players':'A portable cassette player for listening to or transferring analog tapes. Check the power source and output before borrowing.',
  'Audio/Other':'A portable field recorder for capturing sound away from a computer. Check the card, power, inputs, and monitoring setup.',
  'Audio/Headphones':'Headphones for monitoring audio while recording, editing, or listening. Check the plug size and try them at a low volume.',
  'Audio/Instruments':'An electronic instrument or controller for making sound or sending music data. Check its power and audio or MIDI outputs.',
  'Audio/Interfaces':'A device that brings microphones or instruments into a computer for recording. Check the host connection and input type.',
  'Audio/MIDI Controllers':'A controller that sends MIDI messages to software or another instrument. It needs a sound source to be heard.',
  'Audio/Microphones':'A microphone for capturing voice, instruments, or ambient sound. Check the connector and required power.',
  'Audio/Mixers':'A mixer for combining and routing audio sources. Plan the inputs, outputs, and cables before setup.',
  'Audio/Speakers':'A speaker for playing back audio. Check power, input connector, and mounting before use.',
  'Cables & More/Audio Adapters':'An adapter between audio plug sizes or connector types. Check whether each side is an input or output and whether the signal is mono or stereo.',
  'Cables & More/Audio Cables':'A cable for carrying an audio signal between devices. Check plug sizes, signal type, and length before borrowing.',
  'Cables & More/Adapters':'An adapter between different device connectors. Check both ends and the direction of the signal or power.',
  'Cables & More/Batteries':'Rechargeable cells for compatible equipment. Check the size, chemistry, charge state, and device requirements.',
  'Cables & More/Ethernet Cables':'A network cable for connecting compatible Ethernet devices. Check length and the equipment at both ends.',
  'Cables & More/HDMI Adapters':'An HDMI adapter or splitter for a display setup. Check input and output direction; identical plugs do not guarantee conversion.',
  'Cables & More/Laser Pointers':'A handheld pointer for presentations. Keep the beam away from eyes and reflective surfaces.',
  'Cables & More/MIDI Cables':'A five-pin MIDI cable for sending performance data between compatible music devices. It does not carry audio.',
  'Cables & More/Mini DisplayPort Adapters':'An adapter for a Mini DisplayPort video output. Check display input and any direction or resolution limits.',
  'Cables & More/Mini DisplayPort Cables':'A video cable for a device with Mini DisplayPort. Check the display input at the other end.',
  'Cables & More/RCA Cables':'An analog audio cable with RCA and 1/8-inch connections. Check which plug goes to each device.',
  'Cables & More/SD Card Readers':'A reader for moving photos or recordings from a compatible memory card to a computer.',
  'Cables & More/Thunderbolt Adapters':'An adapter between Thunderbolt generations. Check the host, cable, device, and supported direction.',
  'Cables & More/Thunderbolt Cables':'A Thunderbolt cable for compatible high-speed devices. Check connector generation and required length.',
  'Cables & More/USB Cables':'A USB cable for connecting devices or power. Check both plug shapes and whether the cable supports the data or charging rate you need.',
  'Cables & More/USB Adapters':'A USB adapter for connecting a computer or device with a different port. Check host compatibility and data direction.',
  'Cables & More/USB Power Supplies':'A USB power source for compatible devices. Match its output rating and connector to the device label.',
  'Cables & More/Wagons':'A collapsible wagon for moving equipment. Check its rated load and keep heavy items low.',
  'Cables & More/SD Cards':'Removable storage for compatible cameras, recorders, or computers. Check required capacity and speed class.',
  'Computing/Accessories':'A computer accessory for connecting peripherals or displays. Check the host port and any driver or power requirement.',
  'Computing/Cables':'A cable for extending or connecting a computer peripheral. Check the USB connector and whether the device needs extra power.',
  'Computing/Peripherals':'A computer peripheral for input, storage, or control. Check port and software compatibility.',
  'Computing/Other':'A portable computing device. Check power, storage, apps, and any sign-in required for your project.',
  'Lighting/Accessories':'A lighting or presentation accessory. Check that it fits the light, projector, or stand you plan to use.',
  'Lighting/Augmented Reality Systems':'An interactive display or tracking system. Confirm the exact kit, computer compatibility, and clear setup area with staff.',
  'Lighting/DMX Lighting Control':'A controller or interface for DMX lighting. Confirm fixture addresses and cable types before setup.',
  'Photo & Video/Accessories':'A camera or video accessory for mounting, adapting, powering, or shaping a shot. Check the exact fit with your camera and support.',
  'Photo & Video/DVD Players':'A disc player for showing video on a compatible display. Check the disc format and output connection.',
  'Photo & Video/Peripherals':'A control pad for stop-motion or camera software. Check computer and application compatibility.',
  'Photo & Video/Lenses':'An interchangeable camera lens. Confirm the lens mount and camera compatibility before attaching it.',
  'Photo & Video/Stands':'A support for a camera, backdrop, or related equipment. Check its mount and load rating.',
  'Photo & Video/Tripods':'A three-legged camera support for stable photos or video. Check the head, quick-release plate, and load rating.',
  'Shop & Tools/Hand Tools':'A hand tool for gripping, turning, or cutting material. Choose the correct size and secure the workpiece.',
  'Shop & Tools/Accessories':'A charger for compatible tool batteries. Match the battery model before connecting it.',
  'Shop & Tools/Hammers':'A hammer for driving fasteners or shaping material. Use the right head for the work and wear eye protection.',
  'Shop & Tools/Heat Guns':'A hot-air tool for heat-shrink, softening, or forming materials. Work on a heat-safe surface with appropriate ventilation.',
  'Shop & Tools/Impact Drivers':'A powered driver for screws and fasteners. Use impact-rated bits and a compatible charged battery.',
  'Shop & Tools/Levels':'A level and ruler for checking alignment and dimensions. Read the bubble at eye level.',
  'Shop & Tools/Rotary Tool Accessories':'An attachment for a compatible rotary tool. Match the mandrel, speed rating, and material before use.',
  'Shop & Tools/Measuring Tapes':'A retractable 16-foot tape for measuring parts, furniture, and room layouts. Record measurements with units and check them twice.',
  'Shop & Tools/Power Supplies':'An adjustable power source for testing circuits. Set current limits and verify polarity before enabling the output.',
  'Shop & Tools/Screwdrivers':'A screwdriver set for fasteners of different sizes. Choose a bit that fully fits the head to avoid stripping it.',
  'Shop & Tools/Socket Sets':'A socket set for turning nuts and bolts. Match the socket to the fastener and seat it fully before applying force.',
  'Soft Tech/Accessories':'A soft fabrication accessory. Check heat, water, or machine compatibility before using it on finished fabric.',
  'Soft Tech/Steamers':'A garment or fabric steamer for relaxing wrinkles. Check the water and heat instructions for the exact model.',
  'Soft Tech/Cricut Accessories':'A tool or consumable for a compatible Cricut cutter. Check the machine, material, and tool setting before a test cut.',
  'Soft Tech/Sewing Accessories':'A sewing accessory for guiding fabric, forming stitches, or preparing a seam. Check fit with the machine and fabric.',
  'Virtual Reality/VR Accessories':'An accessory for tracking, control, or sensing in an interactive setup. Confirm the required host, software, and cables.',
  'Virtual Reality/Other':'A virtual reality kit with headset and tracking components. Confirm its exact version and every required part at checkout.'
};
function introFor(k){
  const named={'USB C to A Adapter':'An adapter for connecting a USB-A peripheral to a compatible USB-C host. Check data and power support before use.','Lighting Gel Kit':'Colored sheets for changing the look of a light. Keep them clear of hot surfaces and use suitable clamps.'};
  const how=howtoFor(k), lead=(how&&how.what)||named[k.n]||INTRO[k.c+'/'+k.t]||'Listed under '+k.t+' in the '+categoryName(k.c)+' collection.';
  const note=k.d?String(k.d).trim().replace(/\.$/,''):'';          // the short note staff wrote ("Mounts on a camera, 2 XLR inputs") becomes its own sentence
  return lead+(note?' '+note.charAt(0).toUpperCase()+note.slice(1)+'.':'');
}
const CATEGORY_NAME = {'Cables & More':'Cables & Accessories','Lighting':'Lighting & Projection','Soft Tech':'Soft Technologies'};
const categoryName = c => CATEGORY_NAME[c] || c;
// "Good for" lines for the things the inventory file has none for: by exact name first, then by type. Written from what
// each thing is, so the good-for search and the item page cover (nearly) everything.
const GOOD_NAME = {"3.5mm to 2-Male RCA Adapter": "playing a phone or laptop through a mixer or stereo", "Behringer S16 Digital Stage Box": "running many microphones from a stage to a mixer over one cable", "Boompole": "holding a microphone over actors, out of the shot, for film sound", "DPA Clip Bass": "clipping a microphone onto a double bass", "DPA Clip Cello": "clipping a microphone onto a cello", "DPA Clip Guitar": "clipping a microphone onto a guitar", "DPA Clip Piano": "fixing a microphone inside a piano", "DPA Clip Universal": "clipping a microphone onto almost any instrument", "DPA Clip Violin": "clipping a microphone onto a violin or viola", "Headphone Amp": "several people listening on headphones at once, recording sessions", "Microphone Clip": "holding a handheld microphone on a stand", "Microphone Pop Filter": "cleaner voice recording, podcast, singing, voice-over", "Sustain Pedal": "piano-style sustain on a keyboard or synthesizer", "TM-70T Combo Tuner Metronome": "tuning an instrument, practising in time", "Zoom H4essential Field Audio Recorder": "interviews, podcast, sound effects, recording outdoors", "USB C to A Adapter": "plugging a USB-A thing into a USB-C laptop", "7-in-1 USB-C Dongle": "HDMI, USB and card slots for a laptop that only has USB-C", "DisplayPort to HDMI": "connecting a desktop or laptop DisplayPort to a projector or TV", "HDMI (out) to VGA": "connecting to an older projector", "HDMI 90 F-M": "an HDMI plug in a tight space behind a screen", "Keyboard USB": "typing at a kiosk, installation or a Raspberry Pi", "MOUSE USB-C": "a mouse for a USB-C laptop", "MOUSE": "a mouse for a laptop, kiosk or Raspberry Pi", "SD to USB A-C Adapter": "getting photos, video or sound off a memory card onto a computer", "USB C to C Cable (L)": "charging and connecting USB-C devices at a distance", "USB Hub": "more USB ports for a laptop", "USB-C Hub": "more ports for a USB-C laptop", "iPad Mini": "drawing, reference, controlling apps, showing work on a small screen", "iPad Pro": "drawing, video playback, showing work, controlling apps", "Stream Deck Studio Controller": "switching scenes and triggering sounds while streaming or presenting", "USB BluRay Drive": "reading and burning Blu-ray discs", "USB DVD DRIVE": "reading and burning DVDs and CDs", "USB Memory Stick": "moving files between computers, handing in work", "NEC 3D Glasses": "watching 3D projection with the matching projector", "Phone Tripod Mount": "putting a phone on a tripod for filming or scanning", "Stage Pin (Male) to NEMA 5-15 (Female) Electrical Adaptor": "plugging ordinary equipment into theatre power", "Lighting Gel Kit": "colouring or softening a light for photo, film or stage", "5-in-1 43\" Light Reflector-Diffuser": "softer light on a face, portraits, bouncing sunlight outdoors", "A-Mount to E-Mount Lens Adapter": "using older Sony A-mount lenses on a Sony mirrorless camera", "Camera Bracket": "mounting a light or microphone beside the camera", "Canon BP-727": "a spare battery for the Canon camcorder", "Canon EOS EF - EOS R Lens Mount Adapter": "using Canon EF lenses on a Canon R camera", "Mount Adapter EF-EOS R": "using Canon EF lenses on a Canon R camera", "Canon R800 Power Adapter": "running the Canon R800 camcorder from the wall for long recordings", "E6N AC Adapter": "running a Canon camera from the wall for long shoots, time-lapse, streaming", "Gel Filters": "colouring or correcting a light for photo and film", "ICEMAN-SE External Camera Cooling Fan": "long video takes without the camera overheating", "Lightning to HDMI": "showing an iPhone or iPad on a projector or TV", "Magic Arm Clamp": "clamping a light, monitor or small camera where no stand fits", "Magic Arm Type 143": "holding a light, monitor or small camera at an odd angle", "Magic Arm Type 244": "holding a light, monitor or small camera at an odd angle", "Manfrotto 244 RC Magic Arm": "holding a light, monitor or small camera at an odd angle", "Mini Clamp Arm": "clamping a phone, action camera or small light to a table or pole", "MiniHDMI": "connecting a camera to a monitor or recorder", "Phone Mount M": "putting a phone on a tripod", "Shill Smartphone Tripod Mount": "putting a phone on a tripod", "Tripod Phone Mount": "putting a phone on a tripod", "DragonFrame Key Pad": "stop-motion animation with Dragonframe", "Backdrop Support Kit": "hanging a backdrop for portraits, product photos or green screen", "Camera Slider": "smooth sliding camera moves, product shots", "DCB107 Battery Charger": "charging the DeWalt drill and driver batteries", "SteamWave Handheld Steamer": "getting creases out of garments and hanging fabric", "Automatic Buttonhole Foot": "sewing buttonholes on the machine", "Transparent Button Hole Presser Foot": "sewing buttonholes on the machine", "Blind Stitch Foot": "invisible hems on trousers and skirts", "Bobbin Set": "spare bobbins and thread colours for the sewing machine", "Button Sewing Foot": "sewing buttons on by machine", "Crochet Hook": "crochet, pulling threads through, finishing knits", "Embroidery Foot": "free-motion embroidery and darning", "Hemmer Foot": "narrow rolled hems on light fabric", "Overedge Foot": "finishing raw edges so they do not fray", "Pinking Shears": "cutting fabric with a zigzag edge so it does not fray", "Seam Ripper": "undoing stitches, opening seams, alterations", "Sewing Thimble": "hand sewing through thick fabric", "Textile Tool Kit": "hand sewing, measuring and marking fabric", "Walking Foot": "sewing thick layers, quilting, slippery or stretchy fabric", "Wool Pressing Mat - 17\" x 24\"": "pressing seams flat, quilting", "Zipper Foot": "sewing in zips and piping", "Ironing Board": "ironing garments and pressing fabric", "HTC VIVE Kit": "room-scale VR, games, building VR projects on a PC"};
const GOOD_TYPE = {"Audio/Cables": "connecting a microphone or instrument to a mixer, recorder or interface", "Audio/Cassette Players": "playing and digitising old tapes, lo-fi sound", "Audio/Tripods": "holding a microphone on a table or the floor", "Cables & More/Adapters": "making two plugs that do not match fit together", "Cables & More/Audio Adapters": "plugging headphones, microphones or speakers into a different size of jack", "Cables & More/Audio Cables": "connecting speakers, mixers, instruments and recorders", "Cables & More/Batteries": "powering a device away from a wall socket", "Cables & More/Ethernet Cables": "a wired internet connection, steadier than wifi for streaming", "Cables & More/HDMI Adapters": "connecting a laptop, phone or camera to a projector or monitor", "Cables & More/Laser Pointers": "pointing at slides during a presentation or critique", "Cables & More/MIDI Cables": "connecting keyboards, synthesizers and drum machines to each other", "Cables & More/Mini DisplayPort Adapters": "connecting an older Mac or laptop to a projector or monitor", "Cables & More/Mini DisplayPort Cables": "connecting an older Mac or laptop to a monitor", "Cables & More/RCA Cables": "connecting older audio and video gear, record players, TVs", "Cables & More/SD Card Readers": "getting photos, video or sound off a memory card onto a computer", "Cables & More/Thunderbolt Adapters": "connecting fast drives and displays to a Mac", "Cables & More/Thunderbolt Cables": "fast drives, displays and docks on a Mac", "Cables & More/USB Adapters": "plugging a USB-A thing into a USB-C laptop, or the other way round", "Cables & More/USB Cables": "charging, and connecting cameras, interfaces, printers and microcontrollers to a computer", "Cables & More/USB Power Supplies": "charging or powering a USB device from the wall", "Cables & More/Wagons": "carrying a lot of equipment across campus in one trip", "Computing/Cables": "reaching a USB port that is too far away", "Computing/Speakers": "louder sound from a laptop for a small group", "Photo & Video/DVD Players": "playing a DVD on a projector or TV", "Shop & Tools/Hammers": "nails, tapping parts together, hanging work", "Shop & Tools/Hand Tools": "gripping, bending, cutting wire, tightening nuts and bolts", "Shop & Tools/Heat Guns": "heat-shrink tubing, bending plastic, removing stickers and paint", "Shop & Tools/Impact Drivers": "driving long screws into wood, building frames and stands", "Shop & Tools/Levels": "hanging work straight, checking a shelf or a camera is level", "Shop & Tools/Measuring Tapes": "measuring a room, a wall or material before you cut", "Shop & Tools/Power Supplies": "powering a circuit or motor at a set voltage while testing", "Shop & Tools/Rotary Tool Accessories": "cutting, sanding and shaping small parts with the rotary tool", "Shop & Tools/Screwdrivers": "assembling, opening cases, tightening hardware", "Shop & Tools/Socket Sets": "nuts and bolts on furniture, stands and frames", "Soft Tech/Cricut Accessories": "cutting vinyl, paper, card and fabric on the Cricut", "Soft Tech/Steamers": "getting creases out of hanging fabric and garments without an iron", "Virtual Reality/VR Accessories": "tracking hands, bodies and objects, and controllers for games and VR projects"};
const goodFor = k => k.g || GOOD_NAME[k.n] || GOOD_TYPE[k.c+'/'+k.t] || '';
// The eight colours of the console's Home screen. A thing's shelf lights in its category's colour on the console,
// so the same colour marks it here: on its card, on its page and on the category tiles.
const CAT_COLOR = {'Photo & Video':'#007bc0','Audio':'#009647','Lighting':'#fdb515','Computing':'#e0e0e0','Virtual Reality':'#ef3a47','Soft Tech':'#bcb49e','Shop & Tools':'#6d6e71','Cables & More':'#008f91'};   // CMU's tartan and campus colours, the same ones the console uses
const CAT_INK = {'Shop & Tools':'#fff'};          // text on the colour: black, except on Iron Gray
const CAT_ORDER = ['Photo & Video','Audio','Lighting','Computing','Virtual Reality','Soft Tech','Shop & Tools','Cables & More'];
const CAT_SHORT = {'Photo & Video':'Photo and video','Virtual Reality':'VR','Shop & Tools':'Tools','Cables & More':'Cables','Soft Tech':'Soft tech'};
const catColor = c => CAT_COLOR[c] || '#e0e0e0';
const catStyle = c => '--cat:'+catColor(c)+';--cat-ink:'+(CAT_INK[c]||'#000');
const COLLECTION_ID = {'Audio':'81406189450004436','Computing':'81406189430004436','Virtual Reality':'81406189440004436','Lighting':'81406189420004436','Cables & More':'81406189380004436','Photo & Video':'81406189410004436','Soft Tech':'81406189370004436','Shop & Tools':'81406189360004436'};
const collectionUrl = c => 'https://cmu.primo.exlibrisgroup.com/discovery/collectionDiscovery?collectionId='+COLLECTION_ID[c]+'&lang=en&vid=01CMU_INST%3A01CMU';
const localDateTime = date => {
  const pad = n => String(n).padStart(2,'0');
  return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'T'+pad(date.getHours())+':'+pad(date.getMinutes());
};
const calendarStamp = date => date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
// one line of a calendar file: commas, semicolons and line breaks escaped, long lines folded at 73 letters (the .ics rules)
const icsLine = (name,value) => { const text=name+':'+String(value).replace(/\\/g,'\\\\').replace(/([,;])/g,'\\$1').replace(/\r?\n/g,'\\n'); const parts=[]; for(let i=0;i<text.length;i+=73)parts.push((i?' ':'')+text.slice(i,i+73)); return parts.join('\r\n'); };
function calendarFile(k,due){
  const end=new Date(due.getTime()+30*60*1000), title='Return '+k.n+' to IDeATe Lending';
  const alarm=(when,words)=>['BEGIN:VALARM','ACTION:DISPLAY',icsLine('DESCRIPTION',words),'TRIGGER:'+when,'END:VALARM'];
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Room Locator//IDeATe Lending return reminder//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    'UID:'+calendarStamp(new Date())+'-'+(k.h||'item')+'@olivedevs.github.io','DTSTAMP:'+calendarStamp(new Date()),'DTSTART:'+calendarStamp(due),'DTEND:'+calendarStamp(end),
    icsLine('SUMMARY',title),icsLine('LOCATION','IDeATe Lending, Hunt Library A29, Carnegie Mellon University'),
    icsLine('DESCRIPTION',(k.list?'Everything to bring back: '+k.list+'.\n':'')+'Return the borrowed item by the date and time confirmed at checkout. Hand it to staff in Hunt Library A29.\nLoans cannot be renewed. For illness or an emergency, email help@ideate.cmu.edu before it is due. Late fees are charged by the day.\nItem guide: '+location.origin+location.pathname+(k.url||'?i='+(k.h||''))),
    ...alarm('-P1D',title+': due tomorrow'),...alarm('-PT2H',title+': due in 2 hours'),'END:VEVENT','END:VCALENDAR'].join('\r\n')+'\r\n';
}
function attachCalendar(k,fromConsole){
  const input=document.getElementById('return-date'),button=document.getElementById('calendar-button'),ics=document.getElementById('ics-button'),estimate=document.getElementById('estimate-button'),status=document.getElementById('calendar-status');
  input.min=localDateTime(new Date());
  const fillEstimate=()=>{
    const due=new Date();
    due.setDate(due.getDate()+3);
    due.setHours(18,0,0,0);
    input.value=localDateTime(due);
    status.textContent='Normal loan filled in: 3 days, due 6 p.m. Change it if your checkout email says otherwise.';
  };
  const extend=document.getElementById('extend-link');
  const setExtend=()=>{if(!extend)return;const due=new Date(input.value),when=input.value&&!Number.isNaN(due.getTime())?due.toLocaleString([], {weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}):'(fill in from your checkout email)';
    extend.href='mailto:help@ideate.cmu.edu?subject='+encodeURIComponent('Extension request: '+k.n)+'&body='+encodeURIComponent('Hello,\n\nI borrowed this from IDeATe Lending and cannot return it by the due time.\n\nItem: '+k.n+'\nDue: '+when+'\nMy Andrew ID: \n\nWhy I need more time (illness, emergency):\n\nWhen I can return it:\n\nThank you')};
  input.addEventListener('change',setExtend);
  estimate.addEventListener('click',()=>{fillEstimate();setExtend()});
  if(fromConsole)fillEstimate();
  setExtend();
  const dueOrAsk=()=>{
    const due=new Date(input.value);
    if(!input.value||Number.isNaN(due.getTime())||due<=new Date()){
      status.textContent='Enter the future return date and time staff gave you first.';
      input.focus();
      return null;
    }
    return due;
  };
  ics.addEventListener('click',()=>{
    const due=dueOrAsk(); if(!due)return;
    const link=document.createElement('a');
    link.href=URL.createObjectURL(new Blob([calendarFile(k,due)],{type:'text/calendar;charset=utf-8'}));
    link.download='Return '+k.n.replace(/[^A-Za-z0-9 ._-]+/g,' ').replace(/\s+/g,' ').replace(/[ .]+$/,'').trim().slice(0,60)+'.ics';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(link.href),60000);
    status.textContent='A calendar file was made. Open it and choose Add: your calendar will alert you the day before and 2 hours before it is due.'+(rememberLoan(k,due)?' It is also on My loans on this phone.':'');calendarPup(status);
  });
  button.addEventListener('click',()=>{
    const due=dueOrAsk(); if(!due)return;
    // a Google Calendar link cannot set its own alerts, so the event covers the 2 hours before the deadline:
    // the person's usual Google alert then goes off before that window, and the block sits in their day
    const start=new Date(Math.max(Date.now()+60000,due.getTime()-2*60*60*1000));
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'America/New_York';
    const by=due.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
    const params=new URLSearchParams({action:'TEMPLATE',text:'Return '+k.n+' to IDeATe Lending by '+by,dates:calendarStamp(start)+'/'+calendarStamp(due),stz:zone,etz:zone,details:(k.list?'Everything to bring back: '+k.list+'.\n\n':'')+'Due back at '+by+' on '+due.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'})+'. This event covers the last 2 hours before the deadline. Hand the item to staff in Hunt Library A29.\n\nLoans cannot be renewed. For illness or an emergency, email help@ideate.cmu.edu before it is due. Late fees are charged by the day.\n\nFor a warning the day before, choose Add notification and set 1 day before you save.\n\nItem guide: '+location.origin+location.pathname+(k.url||'?i='+(k.h||'')),location:'IDeATe Lending, Hunt Library A29, Carnegie Mellon University'});
    status.textContent='Google Calendar opened with the last 2 hours before the deadline blocked out. It uses your own alert setting, so add a 1 day notification there if you want one, then save.'+(rememberLoan(k,due)?' It is also on My loans on this phone.':'');calendarPup(status);
    window.open('https://calendar.google.com/calendar/r/eventedit?'+params.toString(),'_blank','noopener,noreferrer');
  });
}

// These are preparation prompts, not claims about what is included in a loan.
const GUIDE = {
  'Audio/Field Recorders': {need:['A compatible memory card with free space','Fresh batteries or the correct power supply','Headphones to check the recording','An external microphone and XLR cable if using XLR inputs'],start:['Insert the card and confirm the recorder sees it.','Select the input and recording format, then set levels while listening on headphones.','Record a short test and play it back before the real take.']},
  'Audio/Microphones': {need:['A recorder, camera, mixer, or audio interface with a matching input','The matching cable or wireless receiver','A stand, clip, or mount if needed','Headphones for a test recording'],start:['Check the connector and power requirements on the exact microphone.','Mount it securely, connect it, and set input gain on the receiving device.','Record and listen to a short test before starting.']},
  'Audio/Interfaces': {need:['A computer with recording software','The correct USB or other host cable','A microphone or instrument with its matching cable','Headphones or monitors'],start:['Connect the interface and select it in your recording software.','Plug in your source and set input type and gain.','Listen through headphones and make a test recording.']},
  'Audio/Mixers': {need:['Audio sources and cables that match the input jacks','Speakers or a recorder and output cables','Headphones for monitoring','The correct power supply'],start:['Turn levels down before connecting and powering equipment.','Route each input to the intended output.','Raise levels gradually and check for clipping.']},
  'Audio/Speakers': {need:['A power outlet or charged battery, depending on the model','An audio source and matching cable, or Bluetooth if supported','A stand if the speaker needs elevation'],start:['Place the speaker securely and start with its volume low.','Connect the source and raise levels gradually.','Check for distortion before use.']},
  'Audio/Headphones': {need:['A source with a headphone output','A 3.5 mm or 1/4 inch adapter if the plugs differ'],start:['Connect to the headphone output.','Start at a low volume and raise it gradually.']},
  'Audio/Instruments': {need:['The correct power source or charged battery','Headphones, speaker, or audio interface if you need to hear or record it','Any required audio or MIDI cables'],start:['Check power and output connections on the exact model.','Start at a low volume.','Try a short sound check before recording or performing.']},
  'Audio/MIDI Controllers': {need:['A computer or compatible host','A compatible USB or MIDI cable','Music software or another instrument to receive MIDI'],start:['Connect the controller and select it as a MIDI input in your software.','Choose an instrument or mapping and test a few controls.']},
  'Audio/Cassette Players': {need:['A cassette tape you are allowed to play','Batteries or the correct power adapter for the exact player','Headphones or a matching audio cable if needed'],start:['Check the tape and power source, then insert the cassette gently.','Start at low volume and test play, stop, and rewind.']},
  'Audio/Other': {need:['A compatible memory card with free space','Fresh batteries or the correct power supply','Headphones to check the recording','A microphone and XLR cable if using an external input'],start:['Insert the card and check that the recorder recognizes it.','Set the input and recording format.','Record and play back a short test.']},
  'Audio/Sound Blankets': {need:['A stand, rail, or approved mounting point','Clips or ties appropriate to the blanket and support'],start:['Hang the blanket so it cannot fall onto equipment or block ventilation.','Record a short test and adjust its position to reduce reflections.']},
  'Photo & Video/DSLR Cameras': {need:['A charged battery and compatible memory card','A compatible lens','A card reader or transfer cable','A tripod and microphone if your project needs them'],start:['Mount the lens and check the battery and card.','Set photo or video mode, focus, and exposure.','Capture and review a short test.']},
  'Photo & Video/Mirrorless Cameras': {need:['A charged battery and compatible memory card','A lens with the correct mount','A card reader or transfer cable','A tripod and microphone if your project needs them'],start:['Mount the lens and confirm the card and battery.','Set recording format, focus, and exposure.','Capture and review a short test.']},
  'Photo & Video/Camcorders': {need:['A charged battery or appropriate power adapter','A compatible memory card','A tripod, microphone, or cable if your project needs one'],start:['Check the card, battery, and recording format.','Frame and focus your shot.','Record and play back a short test.']},
  'Photo & Video/360 Cameras': {need:['A charged battery and compatible memory card','A phone or computer with compatible transfer or editing software','A mount or tripod if needed'],start:['Check the card and battery.','Keep the camera level and objects away from the stitch line.','Record and review a short test.']},
  'Photo & Video/Lenses': {need:['A camera with the same lens mount, or an appropriate adapter','A camera body cap and lens caps for transport','A tripod if the lens is heavy or exposure is long'],start:['Confirm the lens mount before attaching it.','Align the mounting marks and turn gently until locked.','Check autofocus, aperture, and image quality on your camera.']},
  'Photo & Video/Gimbals': {need:['A compatible camera or phone','Charged gimbal and camera batteries','The mounting plate or phone clamp for this model'],start:['Mount and balance the device before powering the gimbal.','Calibrate if the model requires it.','Walk a short test shot and review the footage.']},
  'Photo & Video/Tripods': {need:['A camera or phone with a compatible mount','The tripod quick-release plate, if this model uses one'],start:['Open the legs fully on level ground.','Secure the camera or phone and lock all adjustments.','Check stability before letting go.']},
  'Lighting/Projectors': {need:['A power outlet and correct power cable','A source device and matching video cable or adapter','A projection surface or screen','Speakers if sound is needed and the projector has none'],start:['Place the projector with clear ventilation.','Connect power and source, select the input, then focus and adjust the image.','Test image and sound before your presentation.']},
  'Lighting/Lights': {need:['Correct power supply or charged batteries','A stable stand or mounting point','A diffuser or modifier if the setup calls for one'],start:['Mount the light securely and keep ventilation clear.','Power on at low brightness.','Adjust angle, brightness, and color temperature for a test image.']},
  'Lighting/Light Sticks': {need:['Charged battery or correct power supply','A mount or stand if hands-free use is needed'],start:['Check battery and mounting.','Set brightness and color, then photograph or film a test.']},
  'Lighting/DMX Lighting Control': {need:['DMX-compatible fixtures and matching DMX cables','Power for the controller and fixtures','A fixture address and channel plan'],start:['Read the controller and fixture manuals for their DMX modes.','Connect the DMX chain and assign addresses.','Test one channel at a time before a show.']},
  'Computing/Laptops': {need:['The correct charger','Any required account credentials and software','Adapters for external displays or peripherals'],start:['Power on and check battery and Wi-Fi.','Connect needed peripherals and test the software before your session.']},
  'Computing/Monitors': {need:['A power cable','A device and compatible display cable or adapter'],start:['Connect power and video.','Select the correct input on the monitor.','Set resolution and layout on the computer.']},
  'Computing/Speakers': {need:['A power outlet or charged battery, depending on the model','A computer with a matching audio connection or Bluetooth if supported'],start:['Connect with the volume low.','Select the correct sound output on the computer and test playback.']},
  'Computing/Webcams': {need:['A computer with a compatible USB port','A video call or recording app','A mount or tripod if needed'],start:['Connect the webcam and allow camera permissions.','Select it in the app and check framing, light, and sound.']},
  'Soft Tech/Sewing Machines': {need:['Thread, a compatible bobbin, and a suitable needle','Fabric scraps for a test seam','The correct presser foot and power cord'],start:['Read the threading diagram for this exact model.','Wind and install the bobbin, then thread the top path.','Test the stitch and tension on scrap fabric.']},
  'Soft Tech/Cricut Machines': {need:['A computer or phone with Cricut Design Space','A compatible cutting mat or approved smart material','The correct blade or tool housing','Material for a test cut'],start:['Connect and set up the machine in Design Space.','Choose the matching material and tool.','Make a small test cut before a full project.']},
  'Soft Tech/Irons': {need:['A safe ironing surface','Fabric care information','Water if using steam and the model supports it'],start:['Set heat for the fabric and allow the iron to warm up.','Test on an inconspicuous area.','Unplug and let it cool before returning.']},
  'Soft Tech/Steamers': {need:['Water if required by the model','A hanger or safe work surface','A power outlet'],start:['Fill only as directed by the manufacturer.','Allow it to heat, then test on a hidden fabric area.','Let it cool before emptying or packing.']},
  'Virtual Reality/VR Headsets': {need:['Charged headset and controllers or the required power supply','A clear play area','A compatible computer, sensors, and cables if this headset requires them','An account or software setup if the model requires it'],start:['Confirm all headset and controller components at checkout.','Set up the play boundary and adjust fit.','Run the model’s setup process before starting an app.']},
  'Shop & Tools/Drills': {need:['Charged compatible battery or power cable','The right drill bit and workpiece clamp','Eye protection'],start:['Secure the workpiece and fit the bit firmly.','Choose the direction and speed or clutch setting.','Test on scrap material first.']},
  'Shop & Tools/Impact Drivers': {need:['Charged compatible battery','Impact-rated bit and correct fasteners','Eye protection'],start:['Secure the workpiece and fit the correct bit.','Start slowly and stop when the fastener is seated.']},
  'Shop & Tools/Rotary Tools': {need:['A compatible accessory for the material and task','Eye protection and a secured workpiece','The correct battery or power supply'],start:['Install the accessory while power is off.','Select the speed recommended for the accessory and material.','Test on scrap first.']},
  'Shop & Tools/Glue Guns': {need:['Compatible glue sticks','A heat-safe surface and power outlet'],start:['Insert the correct glue stick and let the tool warm up.','Test on scrap material and avoid touching the hot tip.','Unplug and let it cool before packing.']},
  'Shop & Tools/Heat Guns': {need:['A heat-safe work area and surface','Power outlet','Eye protection and ventilation appropriate to the material'],start:['Keep the nozzle moving and away from flammable materials.','Test the heat setting on scrap.','Let the tool cool fully before packing.']}
  ,'Cables & More/Laser Pointers': {need:['Working batteries for the exact pointer','A clear presentation surface'],start:['Check the battery and test the pointer briefly.','Keep the beam away from eyes, people, vehicles, and reflective surfaces.']}
  ,'Cables & More/Wagons': {need:['A load within the wagon’s printed rating','A clear route and a place to store it safely'],start:['Open and lock the frame and wheels.','Place heavy items low and test the handle before moving.']}
  ,'Lighting/Augmented Reality Systems': {need:['The exact headset, display, or tracking components listed for this kit','A compatible computer or phone and required software','Power, cables, and enough clear space'],start:['Confirm the exact kit contents and device compatibility at checkout.','Follow the maker setup for that model and run a short tracking test.']}
  ,'Virtual Reality/Other': {need:['A compatible computer and the kit’s headset, controllers, sensors, and cables','Power outlets and a clear play area','The software needed for the exact VIVE version'],start:['Confirm every kit component at checkout.','Install the model-specific software and set up tracking.','Test a short session inside a clear boundary.']}
};
const SIMPLE_CABLE = /Cables|Adapters|Power Strips|Extension Cords|Power Supplies|SD Cards|SD Card Readers|Batteries/;
const NAME_RULES = [
  [/SD Card|microSD|Memory Stick/i,{need:['A device that accepts this card type and capacity','A compatible card reader for transferring files'],start:['Check the card format and capacity supported by your device.','Back up existing files before formatting or recording.','Eject the card in software before removing it.']}],
  [/Battery Charger|Rechargeable AA Batteries|Canon BP-727|E6N AC Adapter/i,{need:['The exact battery or device this accessory supports','A compatible power outlet or power cable'],start:['Match the battery chemistry, voltage, and connector to the label.','Connect it as directed and confirm the charge or power indicator.']}],
  [/Power Strip|Extension Cord/i,{need:['A grounded outlet that matches the plug','Devices within the cord or strip’s printed current rating'],start:['Inspect the cord and check its rating before use.','Keep the cable out of walkways and do not daisy-chain power strips.']}],
  [/USB.*(Hub|Dongle)|7-in-1 USB-C Dongle|Card Reader/i,{need:['A computer or tablet with the matching USB port','The card or peripherals you plan to connect','External power if the hub or attached devices require it'],start:['Connect the hub or reader to a compatible port.','Insert one device or card and confirm the computer recognizes it.','Eject storage devices before unplugging.']}],
  [/Boompole/i,{need:['A microphone with compatible mount or shock mount','An XLR cable long enough to run along the pole','A recorder or mixer and headphones'],start:['Secure the microphone and cable to prevent handling noise.','Keep the pole clear of lights and people.','Monitor a short test recording.']}],
  [/DPA Clip|Microphone Clip|Pop Filter/i,{need:['A microphone or instrument with a compatible clip or mount','A stand or boom if the accessory needs one'],start:['Confirm the clip fits without forcing it.','Position it securely and test for vibration or unwanted noise.']}],
  [/Headphone Amp/i,{need:['A power source for the amplifier','An audio source and matching input cable','Headphones with compatible plugs'],start:['Connect the source and headphones with levels down.','Power on and raise the listening level gradually.']}],
  [/Sustain Pedal/i,{need:['A keyboard with a sustain-pedal jack','The correct polarity setting, if the keyboard offers one'],start:['Connect the pedal before turning on the keyboard.','Play a note and verify the pedal sustains and releases it.']}],
  [/Microphone Stand|Mic Stand|Speaker Stand|Light Stand|Backdrop Support|Projection Screen/i,{need:['The device or screen this stand supports','Matching mount or clamp','A level floor and enough clear space'],start:['Spread or lock the base fully.','Secure the mounted item and manage cable strain.','Check stability before leaving it unattended.']}],
  [/Reflector|Diffuser|Lighting Gel|Gel Filters/i,{need:['A light source or scene to shape','A stand, clamp, or person to hold the accessory','A modifier rated for the light’s heat if used near a lamp'],start:['Secure the accessory outside the hot parts of the light.','Make a test photo or video and adjust the angle or color.']}],
  [/Camera Bracket|Magic Arm|Mini Clamp Arm|Tripod Phone Mount|Phone Mount|Tripod Mount|Mount Adapter/i,{need:['The camera, phone, lens, or support this part is made for','Compatible screw thread or lens mount','A load within the accessory’s rating'],start:['Check the thread or mount before attaching.','Tighten gently and support the device while testing the connection.']}],
  [/Cricut.*(Blade|Housing|Mat|Pen|Scraper|Tool)|Cricut Deep Housing|Cricut Fine Housing/i,{need:['A Cricut machine compatible with this accessory','Material and Design Space settings that match the tool'],start:['Confirm machine and tool compatibility.','Install the accessory as directed, then run a small test.']}],
  [/Sewing.*Foot|Buttonhole Foot|Blind Stitch Foot|Bobbin Set|Zipper Foot|Walking Foot|Hemmer Foot|Overedge Foot|Embroidery Foot/i,{need:['A sewing machine that accepts this foot or bobbin','Thread, needle, and scrap fabric for a test'],start:['Confirm the attachment system or bobbin size for your machine.','Attach it with the needle raised and power off.','Sew a short test on scrap fabric.']}],
  [/Seam Ripper|Pinking Shears|Crochet Hook|Thimble/i,{need:['Fabric, thread, or yarn for your project','A safe place to store sharp points or blades'],start:['Choose the tool size for the material.','Try it on a small sample before working on the finished piece.']}],
  [/Xbox Control|Vive Tracker|Leap Controller|Kinect2|Intel RealSense/i,{need:['A compatible computer, console, or VR system','Required cable, receiver, or batteries','Software or drivers for the exact model'],start:['Confirm compatibility before borrowing.','Connect or pair the device and check that the software detects it.','Test tracking or controls in a small demo.']}],
  [/Digital Caliper|Measuring Tape|Level and Ruler/i,{need:['The object or space you need to measure','A known reference measurement if precision matters'],start:['Check the units and zero point.','Measure twice and record the value with units.']}],
  [/Pliers|Wrench|Hammer|Screwdriver|Socket Set/i,{need:['A fastener or workpiece that matches the tool size','Eye protection when striking, cutting, or applying force'],start:['Choose the correct size or jaw position.','Secure the workpiece and apply force gradually.']}],
  [/USB DVD|USB BluRay|DVD Player/i,{need:['A compatible computer or display','The disc you want to use','A USB, HDMI, or power cable as required by the exact model'],start:['Connect the player or drive and insert the disc.','Open compatible playback software or select the display input.','Test playback before your presentation.']}],
  [/Keyboard USB|MOUSE|Web Cam/i,{need:['A computer with a matching USB port or wireless receiver','Batteries if this specific device is wireless'],start:['Connect or pair the device.','Confirm the computer detects it and test the controls.']}],
  [/iPad Mini|iPad Pro/i,{need:['A charged tablet and matching charger','Apps or files needed for your project','A compatible stylus or adapter if your workflow requires one'],start:['Check charge and available storage.','Open the needed app and test any accessories.','Remove your personal files and sign out of personal accounts before return.']}],
  [/Light Stick|Tube Light/i,{need:['A charged battery or correct charger','A secure mount or stand if hands-free use is needed'],start:['Check the charge and mounting.','Set brightness and color, then make a test image.']}]
];
const OVERRIDE = {
  'Bench Power Supply':{need:['A power outlet','Test leads rated for the intended voltage and current','A load or circuit with known voltage and current limits'],start:['With the output off, set the voltage and current limit for your circuit.','Check polarity and lead connections before enabling the output.','Watch the displayed current during a short test.']},
  'SteamWave Handheld Steamer':{need:['Water if required by the label','A hanger or safe work surface','A power outlet'],start:['Confirm the exact model and fill only as directed.','Test on a hidden fabric area.','Allow it to cool before packing.']},
  'TM-70T Combo Tuner Metronome':{need:['Two AAA batteries','An instrument or sound source','An instrument cable or contact mic if using its input instead of the built-in mic'],start:['Set the reference pitch and choose tuner or metronome mode.','Play one note or set a tempo and check the display.']},
  'Intuos Pro Pad PTH660':{need:['A computer and compatible USB cable or Bluetooth','The Wacom Pro Pen','Current Wacom driver and a drawing app'],start:['Connect the tablet and install the driver.','Open Wacom settings to map the tablet and pen.','Make a few test strokes in your app.']},
  'Zoom H1 Audio Recorder':{need:['A compatible microSD card and one AA battery','Headphones to review the recording'],start:['Insert the card and battery.','Set recording level, then record and play back a short test.']},
  'Zoom H1n Audio Recorder':{need:['A compatible microSD or microSDHC card','Two AAA batteries or the correct USB power source','Headphones to review the recording']},
  'Behringer S16 Digital Stage Box':{need:['A compatible digital mixer or AES50 host','Shielded CAT5e cable appropriate for AES50','XLR cables for microphones and outputs','Power outlet'],start:['Confirm AES50 compatibility and cabling before connection.','Connect the stage box and mixer with levels down.','Verify channel routing and test one input and output.']},
  'DEEPMIND 12 MIDI Controller':{need:['Power outlet and correct power cord','Headphones or an audio cable to a mixer or interface','MIDI or USB connection only if controlling or syncing other gear'],start:['Connect audio before raising levels.','Select a sound and play a short test.','Use MIDI setup only if the project needs it.']},
  'Acer Mixed Reality Headset and Controllers':{need:['A compatible Windows PC and required headset cables','Controller batteries','A clear play area'],start:['Check current Windows Mixed Reality support for your PC before borrowing.','Connect the headset and pair controllers.','Set a play boundary.']},
  'Lenovo Explorer':{need:['A compatible Windows PC and required headset cables','Controller batteries','A clear play area'],start:['Check current Windows Mixed Reality support for your PC before borrowing.','Connect the headset and pair controllers.','Set a play boundary.']},
  'Odyssey':{need:['A compatible Windows PC and required headset cables','Controller batteries','A clear play area'],start:['Confirm the exact Odyssey model and current Windows Mixed Reality support at the desk.','Connect the headset and pair controllers.','Set a play boundary.']},
  'Oculus Quest 2':{need:['A charged headset and two controllers','A clear play area and Wi-Fi','A Meta account for setup or app access'],start:['Adjust fit and lens spacing.','Pair controllers and draw a play boundary.','Try a short session and take breaks as needed.']},
  'Oculus Quest II - Reserve':{need:['A charged headset and two controllers','A clear play area and Wi-Fi','A Meta account for setup or app access']},
  'Stage Pin (Male) to NEMA 5-15 (Female) Electrical Adaptor':{need:['A qualified person to confirm connector, voltage, current, and grounding compatibility'],start:['Do not connect it based on plug shape alone.','Ask IDeATe staff to verify the intended equipment and venue power.']}
};
function guideFor(k){
  const exact=OVERRIDE[k.n]||{}; const base=GUIDE[k.c+'/'+k.t]||{};
  if(k.need?.length&&k.start?.length)return {need:k.need,start:k.start};
  if(Object.keys(base).length||Object.keys(exact).length)return {...base,...exact};
  const named=NAME_RULES.find(([pattern])=>pattern.test(k.n));
  if(named)return named[1];
  if(SIMPLE_CABLE.test(k.t)||/Cable|Adapter|Battery|Card|Hub|Dongle/.test(k.n))return {need:['Devices with matching connectors and signal standards','Any other cable or adapter needed to complete the connection'],start:['Check the connector shape and the signal each device sends or accepts.','Connect with devices powered down when appropriate, then test the full path.']};
  if(/Accessories|Peripherals|Stands|Tripods|Sewing|Tools|Lenses/.test(k.t))return {need:['The main device or project this accessory is used with','Matching mount, connector, size, or material as applicable'],start:['Confirm compatibility with the exact device or material.','Fit it gently and test the setup before use.']};
  return {need:['The item’s power source or required host device','Compatible cables, mounts, media, or supplies for your project'],start:['Confirm the exact model and included parts at checkout.','Read the maker instructions if available and make a small test before your main project.']};
}
const listItems = items => '<ul>'+items.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>';
function external(label,url){return '<a class="source-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>'}
// the library catalog's own picture of the item comes first; a general stand-in photo is the fallback
function photoFor(k){if(k.p&&k.p.none)return null;if(k.p)return k.p;const own=PHOTO.lending?.[k.n];return own?{...own,kind:'lending'}:PHOTO.images?.[PHOTO.items?.[k.n]]}
// a small picture for the list. Only Wikimedia thumbnails, which come in a 120-pixel size; each loads when it scrolls into view
function thumbHtml(k){
  const photo=photoFor(k), small=!photo?'':photo.kind==='lending'?photo.url:/\/\d+px-/.test(photo.url)?photo.url.replace(/\/\d+px-/,'/330px-'):/Special:FilePath\/.*[?&]width=\d+/.test(photo.url)?photo.url.replace(/width=\d+/,'width=330'):'';
  return small?'<img class="card-thumb" src="'+esc(small)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add(\'card-photo-none\');this.remove()">':'<span class="card-thumb card-thumb-none" aria-hidden="true"></span>';
}
function photoHtml(k){
  const photo=photoFor(k);
  if(!photo)return '<figure class="item-photo no-photo"><div class="no-photo-tile" aria-hidden="true"><span>'+esc(k.t)+'</span></div><figcaption><strong>No photo yet</strong><span>We would rather show nothing than a picture of the wrong thing. Ask at the desk to see it.</span></figcaption></figure>';
  if(photo.kind==='lending')return '<figure class="item-photo item-photo-own"><img src="'+esc(photo.url)+'" alt="'+esc('Photo of '+k.n+' from the lending catalog')+'" style="width:'+Math.round(photo.w*Math.min(2,300/photo.h,480/photo.w))+'px" loading="eager" referrerpolicy="no-referrer" onerror="const f=this.closest(\'figure\');if(f)f.classList.add(\'photo-unavailable\');this.remove()"><figcaption><strong>From the lending catalog</strong><span>The library\u2019s own picture of this item.</span><small>Photo: IDeATe Lending, Carnegie Mellon University Libraries \u00b7 <a href="'+esc(photo.page)+'" target="_blank" rel="noopener noreferrer">Catalog record \u2197</a></small></figcaption></figure>';
  const exact=!!k.p||PHOTO.exact?.includes(k.n),illustration=photo.kind==='illustration',alt=illustration?'Illustration of '+k.t:exact?'Photo showing '+k.n:'Representative photo for '+categoryName(k.c)+' / '+k.t;
  const license=photo.license||'',parts=license.match(/^CC (BY-SA|BY) (\d\.\d)$/),licenseUrl=parts?'https://creativecommons.org/licenses/'+parts[1].toLowerCase()+'/'+parts[2]+'/':license==='CC0'?'https://creativecommons.org/publicdomain/zero/1.0/':'';
  const credit=illustration?'Original site illustration':'Photo: '+esc(photo.artist||'Wikimedia Commons contributor')+(photo.page&&photo.page!=='#'?' · <a href="'+esc(photo.page)+'" target="_blank" rel="noopener noreferrer">Source ↗</a>':'')+(licenseUrl?' · <a href="'+licenseUrl+'" target="_blank" rel="noopener noreferrer">'+esc(license)+' ↗</a>':license?' · '+esc(license):'');
  return '<figure class="item-photo"><img src="'+esc(photo.url)+'" alt="'+esc(alt)+'" loading="eager" referrerpolicy="no-referrer"><figcaption><strong>'+(illustration?'Illustration':exact?'Model photo':'Representative photo')+'</strong><span>'+(exact?'Check the loaned unit for the exact version.':'The loaned item may look different.')+'</span><small>'+credit+'</small></figcaption></figure>';
}
const MAKER_SUPPORT=[['Canon','Canon','https://www.usa.canon.com/support'],['Sony','Sony','https://www.sony.com/electronics/support'],
['Cricut','Cricut','https://help.cricut.com/hc/en-us'],['Zoom','Zoom','https://zoomcorp.com/en/us/support/'],
['Panasonic','Panasonic','https://na.panasonic.com/us/support'],['Oculus|Meta Quest','Meta','https://www.meta.com/help/quest/'],
['AKAI','Akai Professional','https://www.akaipro.com/support'],['Epson','Epson','https://epson.com/Support/sl/s'],
['DeWalt','DeWalt','https://www.dewalt.com/support'],['Vive|HTC','HTC Vive','https://www.vive.com/us/support/'],
['Shure','Shure','https://www.shure.com/en-US/support'],['Singer','Singer','https://www.singer.com/support'],
['Sennheiser','Sennheiser','https://www.sennheiser.com/en-us/support'],['Tascam','Tascam','https://tascam.com/us/support/'],
['M-Audio','M-Audio','https://m-audio.com/support'],['Beyerdynamic','beyerdynamic','https://www.beyerdynamic.com/service.html'],
['Korg','Korg','https://www.korg.com/us/support/'],['Alesis','Alesis','https://www.alesis.com/support'],
['Bose','Bose','https://www.bose.com/support'],['Apple','Apple','https://support.apple.com/manuals'],
['Logitech','Logitech','https://support.logi.com/'],['Optoma','Optoma','https://www.optoma.com/us/support/'],
['DJI','DJI','https://www.dji.com/support'],['Brother','Brother','https://support.brother.com/'],
['Manfrotto','Manfrotto','https://www.manfrotto.com/'],['Rode|R\u00f8de','RODE','https://help.rode.com/hc/en-us'],
['Novation','Novation','https://novationmusic.com/support'],['Focusrite','Focusrite','https://support.focusrite.com/'],
['Elgato|Stream Deck','Elgato','https://help.elgato.com/']];
function makerSupport(name){for(const [pat,label,url] of MAKER_SUPPORT){if(new RegExp('\\b('+pat+')\\b','i').test(name))return [label,url]}return null}
function manualHtml(k,manual){
  const choice=MODEL_CHOICES[k.n];
  if(choice)return '<section class="guide-section"><h2>Find your exact manual</h2><p>'+esc(choice.hint)+'</p><label class="field-label" for="model-choice">Model printed on the item</label><select id="model-choice"><option value="">Choose the matching model</option>'+choice.options.map((option,i)=>'<option value="'+i+'">'+esc(option[0])+'</option>').join('')+'</select><div id="model-result" class="model-result" aria-live="polite">If none matches, ask staff for the model number before using a manual.</div></section>';
  if(manual.length)return '<section class="guide-section"><h2>Maker instructions</h2>'+manual.map(r=>external(r[0],r[1])).join('')+'<p class="note">Match the model name on the device before following a guide.</p></section>';
  if(/Cables|Adapters|Extension Cords|Power Strips|Measuring Tapes|Hammers|Hand Tools|Levels|Socket Sets|Screwdrivers|Stands|Tripods|Sewing Accessories|Cricut Accessories|Sound Blankets|Projector Screens/.test(k.t))return '';
  const maker=makerSupport(k.n);
  return '<section class="guide-section"><h2>Find the right manual</h2><p>The inventory name does not identify one verified product model. Read the maker and model number on the item, then look that exact guide up.</p>'+(maker?'<p>'+external('Open '+maker[0]+'\u2019s own support site',maker[1])+'</p>':'')+'<label class="field-label" for="model-number">Maker and model from the label</label><input id="model-number" type="text" placeholder="For example, maker + model number"><a class="source-link" id="manual-search" href="'+esc(search(k.n+' manufacturer manual'))+'" target="_blank" rel="noopener noreferrer">Search for matching manual ↗</a><p class="note">For simple accessories with no electronic controls, the setup steps above may be all you need.</p></section>';
}
// The return reminder. Scanned from the console's QR (address ends in ?i=...) the person is standing in Lending about
// to borrow the thing, so the reminder is the first thing on the page with the normal 3-day due date already filled in.
function reminderHtml(top,name){
  // one compact row at the top of a page opened from the console; the fuller box in the side column otherwise
  if(top)return '<div class="reminder-top"><label for="return-date">Return reminder for '+esc(String(name).replace(/[\s.\/]+$/,''))+'</label><div class="reminder-row"><input id="return-date" type="datetime-local" aria-describedby="calendar-status"><button id="ics-button" type="button">Add to calendar</button><button id="calendar-button" class="button-secondary" type="button">Google Calendar</button></div><button id="estimate-button" type="button" hidden></button><p id="calendar-status" class="calendar-status" role="status"></p><p class="extend-note">No renewals. Illness or an emergency? <a id="extend-link" href="mailto:help@ideate.cmu.edu">Ask for an extension by email</a> before it is due.</p></div>';
  return '<div class="side-block"><h2>Return reminder</h2><label for="return-date">When it is due, from your checkout email</label><input id="return-date" type="datetime-local" aria-describedby="calendar-status"><button id="estimate-button" class="link-button" type="button">Use the usual 3 days</button><div class="reminder-buttons"><button id="ics-button" type="button">Add to calendar</button><button id="calendar-button" class="button-secondary" type="button">Google Calendar</button></div><p id="calendar-status" class="calendar-status" role="status"></p><p class="extend-note">No renewals. Illness or an emergency? <a id="extend-link" href="mailto:help@ideate.cmu.edu">Ask for an extension by email</a> before it is due.</p></div>';
}

// The console's QR ends in &w=AUD-3: the unit and shelf the console has for the thing at that moment. The page trusts
// that over its own list, which only catches up with a move after staff send the console's changes to the website.
function consolePlace(){
  const m=/^([A-Za-z0-9]{1,4})-(\d{1,2})$/.exec(new URLSearchParams(location.search).get('w')||'');
  if(!m)return null;
  const unit=(ROOM.units||[]).find(u=>u.code.toUpperCase()===m[1].toUpperCase()), shelf=Number(m[2]);
  if(!unit)return null;
  return {text:shelf>0&&unit.shelves?unit.name+', shelf '+shelf:'Ask at the desk · '+unit.name};
}
// a hand-written how-to for the kind of thing this is: what it does, its parts, how to use it, what goes wrong
function howtoFor(k){const m=HOWTO.items[k.n];if(!m)return null;const g=HOWTO.guides[m[0]];return g?{...g,note:m[1]||''}:null}
function howtoHtml(h){
  return '<section class="guide-section"><h2>What it is</h2><p>'+esc(h.what)+'</p>'+(h.note?'<p class="howto-note">'+esc(h.note)+'</p>':'')+'</section>'+
  '<section class="guide-section"><h2>Parts and features</h2><dl class="parts">'+h.parts.map(p=>'<div><dt>'+esc(p[0])+'</dt><dd>'+esc(p[1])+'</dd></div>').join('')+'</dl></section>'+
  '<section class="guide-section"><h2>How to use it</h2><ol>'+h.how.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol></section>'+
  '<section class="guide-section"><h2>Good to know</h2>'+listItems(h.watch)+'</section>';
}
// an email to IDeATe's contact address with the item already filled in
function problemLink(k,live){
  const where=live?live.text:k.w;
  return 'mailto:help@ideate.cmu.edu?subject='+encodeURIComponent('Lending item problem: '+k.n)+'&body='+encodeURIComponent('Item: '+k.n+'\nShelf: '+where+'\nGuide page: '+location.origin+location.pathname+(k.url||'?i='+(k.h||''))+'\n\nWhat is wrong (missing part, damage, wrong information on the page):\n\n\nWhen I borrowed it or noticed:\n');
}
function kitsFor(k){const mine=KITS.filter(x=>x.parts.some(p=>p.pick.includes(k.n)));return mine.length?'<div class="side-block"><h2>Part of a kit</h2>'+mine.map(x=>'<a class="source-link" href="#kit-'+esc(x.id)+'">'+esc(x.name)+' \u2192</a>').join('')+'</div>':''}
// Counts how often each guide is opened, so staff can see what students look for. Only the item's code is sent, to a free
// public counter (abacus.jasoncameron.dev): no names, no cookies. Once per item per visit. Staff phones count too: staff borrow as well.
function countOpen(k,fromConsole){
  try{
    if(!k.h||!/^https?:$/.test(location.protocol)||/^(localhost|127\.)/.test(location.hostname))return;
    const seen='rl-seen-'+k.h; if(sessionStorage.getItem(seen))return; sessionStorage.setItem(seen,'1');
    const hit=key=>fetch('https://abacus.jasoncameron.dev/hit/roomlocator-ideate/'+key,{mode:'cors',keepalive:true}).catch(()=>{});
    hit('i-'+k.h); hit(fromConsole?'from-console':'from-site');
  }catch(e){}
}
// the dog shows on an item page only where it is holding that very thing: the tape measure and the headphones
function itemPose(k){
  if(k.n.startsWith('Measuring Tape'))return 'tape';
  if(k.n.startsWith('Shure SM-58'))return 'mic';
  if(k.n==='XLR Cable')return 'cable';
  return '';
}
function calendarPup(status){if(!document.querySelector('.pup-made'))status.insertAdjacentHTML('afterend',pup('calendar','pup-made'))}
function itemView(k,fromConsole){
  app.style.setProperty('--cat',catColor(k.c));app.style.setProperty('--cat-ink',CAT_INK[k.c]||'#000');
  document.body.style.setProperty('--cat',catColor(k.c));document.body.style.setProperty('--cat-ink',CAT_INK[k.c]||'#000');document.body.classList.add('in-cat');   // the banner wears the colour the shelf lights in
  const live=fromConsole?consolePlace():null;
  const guide=guideFor(k), howto=howtoFor(k), group=k.c+'/'+k.t, related=(DATA.goes[group]||[]).filter(g=>K.some(a=>a.c+'/'+a.t===g));
  const manual=(k.r||[]).filter(r=>Array.isArray(r)&&/^https:\/\//.test(r[1]));
  document.title=k.n+' · IDeATe Lending';
  app.innerHTML='<a class="back" href="./">← All items</a>'+(fromConsole?reminderHtml(true,k.n):'')+'<div class="item-lead"><div class="item-summary"><p class="eyebrow">'+esc(categoryName(k.c))+' / '+esc(k.t)+'</p><h1>'+esc(k.n)+'</h1><p class="intro">'+esc(introFor(k))+'</p>'+(goodFor(k)?'<p class="good-for"><strong>Good for</strong> '+esc(goodFor(k))+'</p>':'')+'<aside class="location"><small>Find it in Lending</small><strong>'+esc(live?live.text:k.in?k.w:'Ask at the desk · '+k.w)+'</strong><p>'+(live?'This is the shelf the console in Lending showed when you scanned it.':'Shelf locations and availability can change. The desk has the current information.')+'</p></aside></div>'+photoHtml(k)+'</div>'+
  '<div class="guide-layout"><div class="guide-stack">'+(howto?howtoHtml(howto):'<section class="guide-section"><h2>Before you start</h2>'+listItems(guide.need)+'<p class="note">This is a preparation list. Confirm what comes in the loan with staff; accessories and supplies may be separate.</p></section><section class="guide-section"><h2>First steps</h2><ol>'+guide.start.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol></section>')+
  ((k.tips?.length||TIPS[k.n]||TIPS[group])?'<section class="guide-section"><h2>Useful tips</h2>'+listItems(k.tips||TIPS[k.n]||TIPS[group])+'</section>':'')+((howto&&!manual.length&&!MODEL_CHOICES[k.n])?(makerSupport(k.n)?'<section class="guide-section"><h2>Maker support</h2>'+external('Open '+makerSupport(k.n)[0]+'\u2019s own support site',makerSupport(k.n)[1])+'<p class="note">Read the model on the item to find its exact manual there.</p></section>':''):manualHtml(k,manual))+'</div><aside class="side-stack"><details class="side-block side-fold"><summary>Borrowing rules and late fees</summary><p>At checkout, confirm the exact model, included parts, condition, and return date with staff. For powered devices, test startup before leaving when possible.</p><p>Visit IDeATe Lending in Hunt Library basement, room A29, across from the elevator. Bring your CMU ID. Check current lending hours and borrowing rules before visiting.</p><p>During the semester, the normal loan is three days with a 6 p.m. due time. Weekends count; university holidays may shift the due date.</p><p>Loans cannot be renewed. Hand the item to staff in A29; drop boxes and other libraries do not count. Late fees run from $1 to $25 a day depending on what the item costs, and borrowing is blocked once fines reach $25.</p>'+external('Official IDeATe Lending rules','https://ideate.cmu.edu/resources/lending/index.html')+external('Full circulation policy','https://ideate.cmu.edu/resources/lending/ideate-circulation-policy.html')+external('Browse CMU’s '+categoryName(k.c)+' collection',collectionUrl(k.c))+'</details>'+(related.length?'<div class="side-block"><h2>Often used with</h2>'+related.map(g=>'<a class="source-link" href="#t'+encodeURIComponent(g)+'">'+esc(g.split('/')[1])+'</a>').join('')+'<p>Compatibility and availability vary by model.</p></div>':'')+(fromConsole?'':reminderHtml(false))+kitsFor(k)+'<div class="side-block"><h2>Something wrong with it?</h2><p>Missing a part, broken, or this page is wrong? Tell the lending staff.</p><a class="source-link" href="'+esc(problemLink(k,live))+'">Report a problem by email</a></div></aside></div>';
  attachCalendar(k,fromConsole);
  countOpen(k,fromConsole);
  {const pose=itemPose(k),first=document.querySelector('.guide-stack .guide-section');if(pose&&first)first.insertAdjacentHTML('afterbegin',pup(pose,'pup-item'))}
  const modelChoice=document.getElementById('model-choice');
  if(modelChoice)modelChoice.addEventListener('change',()=>{const result=document.getElementById('model-result'),selected=MODEL_CHOICES[k.n].options[Number(modelChoice.value)];result.innerHTML=modelChoice.value===''?'If none matches, ask staff for the model number before using a manual.':external('Open '+selected[0]+' maker guide',selected[1]);});
  const modelNumber=document.getElementById('model-number');
  if(modelNumber)modelNumber.addEventListener('input',()=>{const term=modelNumber.value.trim();document.getElementById('manual-search').href=search(term?term+' official manual':k.n+' manufacturer manual')});
  const img=app.querySelector('.item-photo img');
  if(img)img.addEventListener('error',()=>{img.hidden=true;img.parentElement?.classList.add('photo-unavailable')});
}
const pup=(pose,cls)=>'<img class="pup '+(cls||'')+'" src="dog/'+pose+'.png?v=2" alt="" aria-hidden="true" loading="lazy">';   // drawings of Loki, Diana's dog, as decoration
function renderCards(rows){const target=document.getElementById('results');document.getElementById('count').textContent=rows.length+' of '+K.length+' items';target.innerHTML=rows.length?rows.map(k=>'<a class="item-card" style="'+catStyle(k.c)+'" href="#i'+k.h+'"><span class="card-photo">'+thumbHtml(k)+'</span><div><strong>'+esc(k.n)+'</strong><small>'+esc(k.t)+'</small><span class="card-where"><i class="led" aria-hidden="true"></i>'+esc(k.in?k.w:'Ask at the desk')+'</span></div></a>').join(''):'<div class="empty-state">'+pup('dig')+'<p>Dug around and found nothing. Try a shorter name or another category.</p></div>'}
function listing(category='',type=''){
  document.title='IDeATe Lending · Item guides';
  const categories=[...new Set(K.map(k=>k.c))].sort();
  app.innerHTML='<div class="hero-row"><div><h1>Find it in Lending</h1><p class="intro">'+K.length+' things to borrow in Hunt Library A29, each with its shelf, how to use it and a return reminder.</p></div>'+(loans().some(x=>x.due<Date.now())?'':'<img class="pup pup-peek" src="dog/'+(matchMedia('(prefers-reduced-motion: reduce)').matches?'hero.png':'hero.webp')+'?v=1" alt="" aria-hidden="true">')+'</div>'+loansHtml()+'<div class="search-mode" role="group" aria-label="How to search"><button type="button" data-mode="name" aria-pressed="true">Find an item</button><button type="button" data-mode="use" aria-pressed="false">What it is good for</button><a href="#kits">Kits for a whole project</a></div><div class="search-tools"><input id="query" type="search" placeholder="Item name: tripod, HDMI, Zoom..." aria-label="Search" autocomplete="off"><select id="category" class="visually-hidden" aria-label="Filter by category" tabindex="-1"><option value="">All categories</option>'+categories.map(c=>'<option value="'+esc(c)+'"'+(c===category?' selected':'')+'>'+esc(categoryName(c))+'</option>').join('')+'</select></div><div class="cat-tiles" role="group" aria-label="Category">'+CAT_ORDER.filter(x=>categories.includes(x)).map(x=>'<button type="button" class="cat-tile" style="'+catStyle(x)+'" data-cat="'+esc(x)+'" aria-pressed="'+(x===category)+'"><strong>'+esc(CAT_SHORT[x]||x)+'</strong><span>'+K.filter(k=>k.c===x).length+'</span></button>').join('')+'</div><div id="kit-hits"></div><p class="result-count" id="count"></p><div class="item-grid" id="results"></div>';
  attachLoans(app);
  const q=document.getElementById('query'),c=document.getElementById('category');
  // the colour tiles drive the (hidden) category list: tap one to filter, tap it again for everything
  app.querySelectorAll('.cat-tile').forEach(b=>b.addEventListener('click',()=>{c.value=c.value===b.dataset.cat?'':b.dataset.cat;app.querySelectorAll('.cat-tile').forEach(o=>o.setAttribute('aria-pressed',String(o.dataset.cat===c.value)));c.dispatchEvent(new Event('input',{bubbles:true}));c.dispatchEvent(new Event('change',{bubbles:true}))}));
  // Two ways to look. "Find an item" reads names and types only; a word nobody spelled that way gets one slip per word
  // (a wrong, missing, extra or swapped letter) against names only. "What it is good for" reads what each thing is
  // for and ranks by how many of the typed words fit, so a sentence like "record an interview outside" works.
  const nameHay=k=>(k.n+' '+k.t).toLowerCase(), catHay=k=>(k.n+' '+k.t+' '+k.c).toLowerCase();
  const useHay=k=>{const h=howtoFor(k);return (k.t+' '+goodFor(k)+' '+(k.d||'')+' '+introFor(k)+(h?' '+h.what+' '+h.note:'')).toLowerCase()};
  const near=(word,hay)=>{if(word.length<4)return false;return hay.split(/[^a-z0-9]+/).some(h=>{if(!h||h[0]!==word[0]||Math.abs(h.length-word.length)>1)return false;let i=0;while(i<word.length&&i<h.length&&h[i]===word[i])i++;if(i===word.length)return true;if(i>=h.length)return i+1===word.length;const rest=(a,b)=>h.slice(a)===word.slice(b);return rest(i+1,i+1)||rest(i+1,i)||rest(i,i+1)||(i+1<word.length&&h[i]===word[i+1]&&h[i+1]===word[i]&&rest(i+2,i+2))})};
  const FILLER=new Set('a an the to for of on in my i me it is and or with want need needs some something that this how do can make making use using good get myself me we our you your thing stuff only has have at into from up out new better more less very really just also than then when where which who will would should could try'.split(' '));
  const stem=w=>{let x=w.length>4?w.replace(/(ing|ed|es|s)$/,''):w; if(x.length>4)x=x.replace(/e$/,''); return x};   // measure, measuring, measured all become measur
  // everyday words on the left; any of the words on the right also counts as a match for them
  const ALSO={hang:'hammer level drill tape',poster:'level tape hammer',straight:'level',wall:'hammer drill level',shelf:'drill level screwdriver',nail:'hammer',screw:'screwdriver drill',bolt:'wrench socket',nut:'wrench socket',tighten:'wrench screwdriver socket',wire:'pliers cutters',cut:'cutters shears cricut pliers',glue:'glue',wood:'drill rotary hammer',length:'measuring tape caliper',size:'caliper measuring',
    movie:'projector screen',film:'camcorder camera video',video:'camcorder camera',vlog:'camera gimbal phone',photo:'camera lens',picture:'camera',portrait:'camera lens light',selfie:'phone tripod ring',shaky:'gimbal tripod',steady:'gimbal tripod',timelapse:'tripod camera',
    podcast:'microphone recorder interface',interview:'microphone recorder lavalier',voice:'microphone recorder',voiceover:'microphone',sing:'microphone interface',song:'microphone interface keyboard',band:'mixer microphone speaker',guitar:'interface cable amp',beat:'drum pad controller',dj:'mixer speaker controller',
    loud:'speaker pa',party:'speaker partybox',announce:'microphone speaker pa',concert:'pa mixer speaker',listen:'headphones speaker',echo:'blanket',quiet:'blanket',
    slide:'projector hdmi laser',presentation:'projector hdmi laser screen',present:'projector hdmi laser',tv:'hdmi monitor',screen:'monitor projector hdmi',laptop:'hdmi hub adapter monitor',zoom:'webcam microphone',call:'webcam microphone',meeting:'webcam microphone',stream:'webcam deck microphone',charge:'usb power',charger:'usb power',internet:'ethernet',wifi:'ethernet',
    dark:'light led',bright:'light led',lamp:'light led',glow:'light tube stick',colour:'rgb gel light',color:'rgb gel light',
    sew:'sewing',hem:'sewing hemmer foot',stitch:'sewing',clothes:'sewing iron steamer',costume:'sewing',wrinkle:'iron steamer',crease:'iron steamer',button:'buttonhole button',zipper:'zipper',sticker:'cricut',vinyl:'cricut',shirt:'cricut iron sewing',knit:'crochet',yarn:'crochet',
    game:'vr quest headset',vr:'headset quest vive rift',carry:'wagon',move:'wagon',heavy:'wagon',memory:'sd card',storage:'sd card usb',disc:'dvd bluray',cd:'dvd drive',tape:'cassette measuring'};
  const useWords=new Map(), wordsOf=k=>{if(!useWords.has(k.h||k.n))useWords.set(k.h||k.n,[...new Set((useHay(k)+' '+k.n.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean))]);return useWords.get(k.h||k.n)};
  const keysOf=words=>words.filter(w=>!FILLER.has(w)).map(stem).filter(w=>w.length>1);
  const has=(tokens,w)=>w.length<4?tokens.includes(w):tokens.some(t=>t.startsWith(w));       // whole words only: "phone" is not in "microphone"
  const alsoOf=w=>(ALSO[w]||ALSO[w.replace(/e$/,'')]||ALSO[w+'e']||'').split(' ').filter(Boolean);
  // A word that fits few things says more than one that fits many ("caliper" against "small"), so each word is worth
  // more the rarer it is. An everyday word that only fits through the list above counts for a bit less.
  const byUse=(pool,words)=>{const keys=[...new Set(keysOf(words))];if(!keys.length)return [];
    const all=K.map(wordsOf), worth={};
    for(const w of keys){const n=all.filter(t=>has(t,w)).length, also=alsoOf(w), m=also.length?all.filter(t=>also.some(a=>has(t,a))).length:0;
      worth[w]=[n?Math.min(3,Math.log(1+K.length/n)):0, m?0.7*Math.min(3,Math.log(1+K.length/m)):0, also]}
    const scored=pool.map(k=>{const t=wordsOf(k);let sum=0;for(const w of keys){if(worth[w][0]&&has(t,w))sum+=worth[w][0];else if(worth[w][1]&&worth[w][2].some(a=>has(t,a)))sum+=worth[w][1]}return [k,sum]}).filter(x=>x[1]>0);
    const best=Math.max(0,...scored.map(x=>x[1]));
    return scored.filter(x=>x[1]>=best*0.5).sort((a,b)=>b[1]-a[1]).slice(0,24).map(x=>x[0])};
  const kitsFor=words=>{const keys=[...new Set(keysOf(words))];if(!keys.length)return [];
    const scored=KITS.map(x=>{const t=(x.name+' '+x.why+' '+x.parts.map(p=>p.role).join(' ')).toLowerCase().split(/[^a-z0-9]+/);const direct=keys.filter(w=>has(t,w)).length, soft=keys.filter(w=>!has(t,w)&&alsoOf(w).some(a=>has(t,a))).length;return [x,direct,direct+soft*0.5]}).filter(x=>x[1]>=Math.min(2,keys.length));
    const best=Math.max(0,...scored.map(x=>x[2]));
    return scored.filter(x=>x[2]===best).map(x=>x[0]).slice(0,2)};
  let mode='name';
  function draw(){
    const words=q.value.trim().toLowerCase().split(/\s+/).filter(Boolean), pool=K.filter(k=>(!c.value||k.c===c.value)&&(!type||k.t===type));
    let rows=pool, said='';
    if(words.length&&mode==='use'){rows=byUse(pool,words);said=rows.length?rows.length+' things good for that':''}
    else if(words.length){
      rows=pool.filter(k=>{const hay=catHay(k),tight=k.n.toLowerCase().replace(/[^a-z0-9]+/g,'');return words.every(w=>hay.includes(w)||(w.length>2&&tight.includes(w)))});
      const inName=k=>words.every(w=>k.n.toLowerCase().includes(w))?0:1;rows=rows.slice().sort((a,b)=>inName(a)-inName(b));
      if(!rows.length){rows=pool.filter(k=>{const hay=nameHay(k);return words.every(w=>hay.includes(w)||near(w,hay))});if(rows.length)said='Nothing spelled exactly like that. '+rows.length+(rows.length===1?' close match':' close matches')}
      if(!rows.length){rows=byUse(pool,words);if(rows.length)said='No item has that name. '+rows.length+(rows.length===1?' thing is':' things are')+' good for it'}
    }
    renderCards(rows);
    const kits=words.length&&(mode==='use'||/good for it/.test(said))?kitsFor(words):[];
    document.getElementById('kit-hits').innerHTML=kits.length?'<p class="result-count">A kit for this</p><div class="item-grid">'+kits.map(x=>'<a class="item-card kit-card" href="#kit-'+esc(x.id)+'"><div><strong>'+esc(x.name)+'</strong><span class="card-where">'+x.parts.length+' pieces, with shelves</span></div><span class="arrow" aria-hidden="true">\u2197</span></a>').join('')+'</div>':'';
    if(said)document.getElementById('count').textContent=said;
    else if(words.length&&mode==='use'&&!rows.length)document.getElementById('count').textContent=kits.length?'':'Nothing matched. Try other words for what you want to do.';
  }
  document.querySelectorAll('.search-mode button').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;document.querySelectorAll('.search-mode button').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));q.placeholder=mode==='use'?'What do you need to do? record an interview, hang a poster...':'Item name: tripod, HDMI, Zoom...';q.focus();draw()}));
  q.addEventListener('input',draw);c.addEventListener('change',()=>{type='';draw()});draw();
}
function roomView(){
  document.title='Room view · IDeATe Lending';
  const placed=ROOM.units.filter(u=>u.rect);
  app.innerHTML='<a class="back" href="./">← All items</a>'+pup('map','pup-room')+'<h1>Explore the lending room</h1><p class="intro">A top view of the Room Locator layout and shelves. '+esc(ROOM.synced&&ROOM.synced.at?'Shelves as the console in Lending had them on '+new Date(ROOM.synced.at).toLocaleDateString([], {month:'long',day:'numeric'})+'.':'Shelves as of the Nov 16 setup.')+' It shows where things live, not whether they are checked out.</p><div class="room-layout"><div class="room-map" aria-label="Top view of lending room">'+placed.map(u=>'<button type="button" class="room-unit" data-unit="'+esc(u.code)+'" style="left:'+(u.rect[0]/2)+'%;top:'+(u.rect[1]/1.5)+'%;width:'+Math.max(5,(u.rect[2]-u.rect[0])/2)+'%;height:'+Math.max(5,(u.rect[3]-u.rect[1])/1.5)+'%"'+((u.rect[3]-u.rect[1])/1.5>(u.rect[2]-u.rect[0])/2*1.4?' data-tall':'')+'><span>'+esc(u.name)+'</span></button>').join('')+'</div><div id="room-detail" class="room-detail"><h2>Choose a unit</h2><p>Tap a unit on the map to see its shelves and what is on each.</p></div></div><p class="note room-note">Shelves are numbered from the bottom: shelf 1 is the lowest. In Lending, the console lights the exact shelf when you look an item up.</p>';
  app.querySelectorAll('.room-unit').forEach(button=>button.addEventListener('click',()=>{
    const unit=ROOM.units.find(u=>u.code===button.dataset.unit),detail=document.getElementById('room-detail');
    app.querySelectorAll('.room-unit').forEach(b=>b.classList.toggle('selected',b===button));
    const shelves=new Map();
    for(let s=1;s<=unit.shelves;s++)if(unit.boards.includes(s))shelves.set(s,[]);
    K.filter(k=>k.u===unit.code).forEach(k=>{const support=unit.boards.filter(b=>b<=k.s).at(-1)||k.s;if(!shelves.has(support))shelves.set(support,[]);shelves.get(support).push(k)});
    detail.innerHTML='<h2>'+esc(unit.name)+'</h2><p>'+unit.boards.length+(unit.boards.length===1?' shelf':' shelves')+', top shelf first</p>'+[...shelves.entries()].sort((a,b)=>b[0]-a[0]).map(([s,items])=>'<div class="room-shelf"><h3>Shelf '+s+'</h3>'+(items.length?items.map(k=>'<a href="#i'+k.h+'">'+esc(k.n)+'</a>').join(''):'<p>No listed items</p>')+'</div>').join('');
  }));
}
// Kits: everything for one kind of project, each piece with its shelf. The first choice in each row is shown large; the others are alternatives.
// ---------- My loans: what this phone was reminded about, until someone presses Returned. Kept in this browser only.
function loans(){try{const v=JSON.parse(localStorage.getItem('rl-loans')||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x.h==='string'&&typeof x.n==='string'&&Number.isFinite(x.due)):[]}catch(e){return []}}
function saveLoans(v){try{localStorage.setItem('rl-loans',JSON.stringify(v));return true}catch(e){return false}}
function rememberLoan(k,due){const v=loans().filter(x=>x.h!==k.h);v.push({h:k.h,n:k.n,due:due.getTime()});v.sort((a,b)=>a.due-b.due);return saveLoans(v)}
function loansHtml(){
  const v=loans();if(!v.length)return '';
  const now=Date.now(),when=t=>new Date(t).toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  return '<section class="my-loans" aria-label="My loans">'+(v.some(x=>x.due<now)?pup('sad','pup-loans'):'')+'<h2>My loans</h2><ul>'+v.map(x=>'<li'+(x.due<now?' class="late"':'')+'><a href="'+(x.h.startsWith('kit-')?'#':'#i')+esc(x.h)+'">'+esc(x.n)+'</a><span>'+(x.due<now?'Was due ':'Due ')+esc(when(x.due))+'</span><button type="button" data-returned="'+esc(x.h)+'">Returned</button></li>').join('')+'</ul><p class="note">Remembered on this phone only. Loans cannot be renewed; hand each one to staff in A29.</p></section>';
}
function attachLoans(root){root.querySelectorAll('[data-returned]').forEach(b=>b.addEventListener('click',()=>{saveLoans(loans().filter(x=>x.h!==b.dataset.returned));const box=root.querySelector('.my-loans');if(box){box.outerHTML=loansHtml();attachLoans(root)}thanksNote()}))}
// a small "thanks" in the corner for a few seconds after Returned is pressed, with the tail-wag animation
function thanksNote(){
  document.querySelector('.thanks-note')?.remove();
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches, n=document.createElement('div');
  n.className='thanks-note';n.setAttribute('role','status');
  n.innerHTML='<img src="dog/'+(still?'thanks.png?v=2':'thanks-wag.webp?v=2')+'" alt="" aria-hidden="true"><p><strong>Thanks for bringing it back.</strong> Hand it to staff in A29 so it is checked in.</p>';
  document.body.appendChild(n);setTimeout(()=>n.remove(),5200);
}
// ---------- The code a kit page shows for the console: RL:KIT: and the page code of each first-choice piece
function kitCodeText(kit){return 'RL:KIT:'+kit.parts.map(p=>K.find(k=>k.n===p.pick[0])).filter(Boolean).slice(0,8).map(k=>k.h).join(',')}
function showKitCode(kit,box){
  const draw=()=>{const q=qrcode(0,'M');q.addData(kitCodeText(kit));q.make();box.innerHTML='<div class="kit-qr">'+q.createSvgTag({cellSize:5,margin:4,scalable:true})+'</div><p>Hold this up to the scanner on the console in Lending. The shelf of every piece lights up, each in its own colour.</p><p class="note">It lights the first choice in each row, up to 8 pieces, and changes nothing. The console needs version 5.14 or newer.</p>'};
  if(window.qrcode){draw();return}
  box.textContent='Making the code...';
  const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';sc.onload=draw;sc.onerror=()=>{box.textContent='The code could not be made. Check the connection and try again.'};document.head.appendChild(sc);
}
function kitsView(id){
  const kit=KITS.find(x=>x.id===id), find=n=>K.find(k=>k.n===n);
  if(!kit){document.title='Kits \u00b7 IDeATe Lending';
    app.innerHTML='<a class="back" href="./">\u2190 All items</a><div class="hero-row"><div><h1>Kits for a whole project</h1><p class="intro">Pick what you are trying to do and get the full list to ask for, with the shelf for each piece.</p></div>'+pup('wave','pup-wave')+'</div><div class="item-grid">'+KITS.map(x=>'<a class="item-card kit-card" href="#kit-'+esc(x.id)+'"><div><strong>'+esc(x.name)+'</strong><span class="card-where">'+x.parts.length+' pieces</span></div><span class="arrow" aria-hidden="true">\u2197</span></a>').join('')+'</div>';return}
  document.title=kit.name+' \u00b7 IDeATe Lending';
  app.innerHTML='<a class="back" href="#kits">\u2190 All kits</a><div class="hero-row"><div><h1>'+esc(kit.name)+'</h1><p class="intro">'+esc(kit.why)+'</p></div></div><div class="kit-list">'+kit.parts.map(p=>{const items=p.pick.map(find).filter(Boolean);if(!items.length)return '';const first=items[0];
    return '<div class="kit-row"><p class="kit-role">'+esc(p.role)+'</p><a class="item-card" href="#i'+first.h+'">'+thumbHtml(first)+'<div><strong>'+esc(first.n)+'</strong><span class="card-where">'+esc(first.in?first.w:'Ask at the desk')+'</span></div><span class="arrow" aria-hidden="true">\u2197</span></a>'+(items.length>1?'<p class="kit-or">or '+items.slice(1).map(k=>'<a href="#i'+k.h+'">'+esc(k.n)+'</a> ('+esc(k.in?k.w:'ask at the desk')+')').join(', or ')+'</p>':'')+'</div>'}).join('')+'</div><div class="kit-reminder">'+reminderHtml(false).replace('<h2>Return reminder</h2>','<h2>One return reminder for the whole kit</h2>')+'</div><div class="guide-section kit-tip"><h2>Light the shelves in Lending</h2><p><button type="button" id="kit-code-go" class="kit-code-go">Show the code for the console</button></p><div id="kit-code" aria-live="polite"></div></div><div class="guide-section kit-tip"><h2>Before you go</h2><p>'+esc(kit.tip)+'</p><p class="note">Each piece is checked out separately and may already be on loan. The desk has what is in today.</p></div>';
  document.getElementById('kit-code-go').addEventListener('click',e=>{e.target.hidden=true;showKitCode(kit,document.getElementById('kit-code'))});
  attachCalendar({n:kit.name+' kit',h:'kit-'+kit.id,url:'#kit-'+kit.id,list:kit.parts.map(p=>(p.pick.map(find).filter(Boolean)[0]||{}).n).filter(Boolean).join(', ')},false);
}
function route(){if(!DATA)return;app.style.removeProperty('--cat');app.style.removeProperty('--cat-ink');document.body.classList.remove('in-cat');document.body.style.removeProperty('--cat');document.body.style.removeProperty('--cat-ink');const hash=decodeURIComponent(location.hash.slice(1));const query=new URLSearchParams(location.search).get('i');let k;
  if(/^i[0-9a-f]{6}$/.test(hash))k=K.find(x=>x.h===hash.slice(1));   // links carry the item's own code, so they keep working when the list changes
  else if(/^k\d+$/.test(hash))k=K[Number(hash.slice(1))];             // (old links by position still open)
  else if(query&&!hash)k=K.find(x=>x.h===query.toLowerCase());
  if(k)itemView(k,!!(query&&!hash));else if(hash==='room')roomView();else if(hash==='kits'||hash.startsWith('kit-'))kitsView(hash.slice(4));else if(hash.startsWith('t')){const [c,t]=hash.slice(1).split('/');listing(c,t)}else{listing();if(/^[ik][0-9a-f]+$/.test(hash)||(query&&!hash)){const lost=document.createElement('div');lost.className='lost-link';lost.innerHTML=pup('surprised')+'<p><strong>That link does not match anything in the list now.</strong> The item may have been renamed or removed. Search for it below.</p>';app.insertBefore(lost,app.firstChild);app.querySelector('.pup-peek')?.remove()}}
  window.scrollTo(0,0);
}
Promise.all([fetch('data.json?v=20261116t').then(r=>{if(!r.ok)throw Error('Inventory unavailable');return r.json()}),fetch('photos.json?v=20261116k').then(r=>r.ok?r.json():{}).catch(()=>({})),fetch('room.json?v=20261116a').then(r=>r.ok?r.json():{units:[]}).catch(()=>({units:[]})),fetch('howto.json?v=20261116b').then(r=>r.ok?r.json():null).catch(()=>null),fetch('kits.json?v=20261118a').then(r=>r.ok?r.json():null).catch(()=>null)]).then(([data,photos,room,howto,kits])=>{if(kits&&Array.isArray(kits.kits))KITS=kits.kits;DATA=data;K=data.kinds;PHOTO=photos;ROOM=room;if(howto&&howto.guides&&howto.items)HOWTO=howto;route();addEventListener('hashchange',route)}).catch(()=>{app.innerHTML='<h1>Item guide unavailable</h1><p>Please try reloading this page.</p>'});
