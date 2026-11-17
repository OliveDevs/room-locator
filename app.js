const app = document.getElementById('app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const search = query => 'https://www.google.com/search?q=' + encodeURIComponent(query);
let DATA, K, PHOTO={}, ROOM={units:[]};
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
  return k.d||k.g||named[k.n]||INTRO[k.c+'/'+k.t]||'Equipment for '+categoryName(k.c).toLowerCase()+'. Check the exact model and included parts with staff before planning your setup.';
}
const CATEGORY_NAME = {'Cables & More':'Cables & Accessories','Lighting':'Lighting & Projection','Soft Tech':'Soft Technologies'};
const categoryName = c => CATEGORY_NAME[c] || c;
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
    icsLine('DESCRIPTION','Return the borrowed item by the date and time confirmed at checkout.\nItem guide: '+location.origin+location.pathname+'?i='+(k.h||'')),
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
  estimate.addEventListener('click',fillEstimate);
  if(fromConsole)fillEstimate();
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
    link.download='Return '+k.n.replace(/[^A-Za-z0-9 ._-]+/g,' ').trim().slice(0,60)+'.ics';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(link.href),60000);
    status.textContent='A calendar file was made. Open it and choose Add: your calendar will alert you the day before and 2 hours before it is due.';
  });
  button.addEventListener('click',()=>{
    const due=dueOrAsk(); if(!due)return;
    const end=new Date(due.getTime()+30*60*1000);
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'America/New_York';
    const params=new URLSearchParams({action:'TEMPLATE',text:'Return '+k.n+' to IDeATe Lending',dates:calendarStamp(due)+'/'+calendarStamp(end),stz:zone,etz:zone,details:'Return the borrowed item by the date and time confirmed at checkout. Check Google Calendar notifications after saving this event.',location:'IDeATe Lending, Hunt Library A29, Carnegie Mellon University'});
    status.textContent='Your event is ready in Google Calendar. Review the time and notification, then save it there.';
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
function photoFor(k){if(k.p&&k.p.none)return null;return k.p||PHOTO.images?.[PHOTO.items?.[k.n]]}
function photoHtml(k){
  const photo=photoFor(k);
  if(!photo)return '<figure class="item-photo no-photo"><div class="no-photo-tile" aria-hidden="true"><span>'+esc(k.t)+'</span></div><figcaption><strong>No photo yet</strong><span>We would rather show nothing than a picture of the wrong thing. Ask at the desk to see it.</span></figcaption></figure>';
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
  if(top)return '<div class="reminder-top"><label for="return-date">Return reminder for '+esc(String(name).replace(/[\s.\/]+$/,''))+'</label><div class="reminder-row"><input id="return-date" type="datetime-local" aria-describedby="calendar-status"><button id="ics-button" type="button">Add to calendar</button><button id="calendar-button" class="button-secondary" type="button">Google Calendar ↗</button></div><button id="estimate-button" type="button" hidden></button><p id="calendar-status" class="calendar-status" role="status"></p></div>';
  return '<div class="side-block"><h2>Return reminder</h2><p>Use the exact due date and time from your checkout email.</p><label for="return-date">Return date and time</label><input id="return-date" type="datetime-local" aria-describedby="calendar-status"><div class="reminder-buttons"><button id="estimate-button" class="button-secondary" type="button">Fill normal 3-day estimate</button><button id="ics-button" type="button">Add to calendar</button><button id="calendar-button" class="button-secondary" type="button">Google Calendar ↗</button></div><p id="calendar-status" class="calendar-status" role="status">Alerts the day before and 2 hours before it is due.</p></div>';
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
function itemView(k,fromConsole){
  const live=fromConsole?consolePlace():null;
  const guide=guideFor(k), group=k.c+'/'+k.t, related=(DATA.goes[group]||[]).filter(g=>K.some(a=>a.c+'/'+a.t===g));
  const manual=(k.r||[]).filter(r=>Array.isArray(r)&&/^https:\/\//.test(r[1]));
  document.title=k.n+' · IDeATe Lending';
  app.innerHTML='<a class="back" href="./">← All items</a>'+(fromConsole?reminderHtml(true,k.n):'')+'<div class="item-lead"><div class="item-summary"><p class="eyebrow">'+esc(categoryName(k.c))+' / '+esc(k.t)+'</p><h1>'+esc(k.n)+'</h1><p class="intro">'+esc(introFor(k))+'</p><aside class="location"><small>Find it in Lending</small><strong>'+esc(live?live.text:k.in?k.w:'Ask at the desk · '+k.w)+'</strong><p>'+(live?'This is the shelf the console in Lending showed when you scanned it.':'Shelf locations and availability can change. The desk has the current information.')+'</p></aside></div>'+photoHtml(k)+'</div>'+
  '<div class="guide-layout"><div class="guide-stack"><section class="guide-section"><h2>Before you start</h2>'+listItems(guide.need)+'<p class="note">This is a preparation list. Confirm what comes in the loan with staff; accessories and supplies may be separate.</p></section><section class="guide-section"><h2>First steps</h2><ol>'+guide.start.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol></section>'+
  ((k.tips?.length||TIPS[k.n]||TIPS[group])?'<section class="guide-section"><h2>Useful tips</h2>'+listItems(k.tips||TIPS[k.n]||TIPS[group])+'</section>':'')+manualHtml(k,manual)+'</div><aside class="side-stack"><div class="side-block"><h2>Borrowing</h2><p>Visit IDeATe Lending in Hunt Library basement, room A29, across from the elevator. Bring your CMU ID. Check current lending hours and borrowing rules before visiting.</p><p>During the semester, the normal loan is three days with a 6 p.m. due time. Weekends count; university holidays may shift the due date. Renewals are no longer offered.</p>'+external('Official IDeATe Lending rules','https://ideate.cmu.edu/resources/lending/index.html')+external('Browse CMU’s '+categoryName(k.c)+' collection',collectionUrl(k.c))+'</div>'+(related.length?'<div class="side-block"><h2>Often used with</h2>'+related.map(g=>'<a class="source-link" href="#t'+encodeURIComponent(g)+'">'+esc(g.split('/')[1])+' →</a>').join('')+'<p>Compatibility and availability vary by model.</p></div>':'')+(fromConsole?'':reminderHtml(false))+'<div class="side-block"><h2>At checkout</h2><p>Confirm the exact model, included parts, condition, and return date with staff. For powered devices, test startup before leaving when possible.</p></div></aside></div>';
  attachCalendar(k,fromConsole);
  const modelChoice=document.getElementById('model-choice');
  if(modelChoice)modelChoice.addEventListener('change',()=>{const result=document.getElementById('model-result'),selected=MODEL_CHOICES[k.n].options[Number(modelChoice.value)];result.innerHTML=modelChoice.value===''?'If none matches, ask staff for the model number before using a manual.':external('Open '+selected[0]+' maker guide',selected[1]);});
  const modelNumber=document.getElementById('model-number');
  if(modelNumber)modelNumber.addEventListener('input',()=>{const term=modelNumber.value.trim();document.getElementById('manual-search').href=search(term?term+' official manual':k.n+' manufacturer manual')});
  const img=app.querySelector('.item-photo img');
  if(img)img.addEventListener('error',()=>{img.hidden=true;img.parentElement.classList.add('photo-unavailable')});
}
function renderCards(rows){const target=document.getElementById('results');document.getElementById('count').textContent=rows.length+' of '+K.length+' items';target.innerHTML=rows.length?rows.map(k=>'<a class="item-card" href="#k'+K.indexOf(k)+'"><div><small>'+esc(categoryName(k.c))+' / '+esc(k.t)+'</small><br><strong>'+esc(k.n)+'</strong><span class="card-where">'+esc(k.in?k.w:'Ask at the desk')+'</span></div><span class="arrow" aria-hidden="true">↗</span></a>').join(''):'<div class="empty-state">No matching items. Try a shorter name or another category.</div>'}
function listing(category='',type=''){
  document.title='IDeATe Lending · Item guides';
  const categories=[...new Set(K.map(k=>k.c))].sort();
  app.innerHTML='<p class="eyebrow">CMU / Hunt Library A29</p><h1>Equipment for what you make</h1><p class="intro">All '+K.length+' things you can borrow from IDeATe Lending. Search by name or by what you need to do, and each page shows the shelf, what to gather, first steps and a return reminder.</p><div class="search-tools"><input id="query" type="search" placeholder="Name or use: tripod, interviews..." aria-label="Search by name or by what you need it for" autocomplete="off"><select id="category" aria-label="Filter by category"><option value="">All categories</option>'+categories.map(c=>'<option value="'+esc(c)+'"'+(c===category?' selected':'')+'>'+esc(categoryName(c))+'</option>').join('')+'</select></div><p class="result-count" id="count"></p><div class="item-grid" id="results"></div>';
  const q=document.getElementById('query'),c=document.getElementById('category');
  // Search looks at the name, the type, what it is good for and what it is. Every typed word has to be there. If nothing
  // fits, it tries again allowing one slip per word (a wrong, missing, extra or swapped letter), the same as the console.
  const hayOf=k=>(k.n+' '+k.c+' '+k.t+' '+(k.g||'')+' '+(k.d||'')).toLowerCase();
  const near=(word,hay)=>{if(word.length<4)return false;return hay.split(/[^a-z0-9]+/).some(h=>{if(!h||h[0]!==word[0])return false;let i=0;while(i<word.length&&i<h.length&&h[i]===word[i])i++;if(i===word.length)return true;if(i>=h.length)return false;const rest=(a,b)=>h.slice(a).startsWith(word.slice(b));return rest(i+1,i+1)||rest(i+1,i)||rest(i,i+1)||(i+1<word.length&&h[i]===word[i+1]&&h[i+1]===word[i]&&rest(i+2,i+2))})};
  function draw(){
    const words=q.value.trim().toLowerCase().split(/\s+/).filter(Boolean), pool=K.filter(k=>(!c.value||k.c===c.value)&&(!type||k.t===type));
    let rows=pool.filter(k=>{const hay=hayOf(k);return words.every(w=>hay.includes(w))}), close=false;
    if(!rows.length&&words.length){rows=pool.filter(k=>{const hay=hayOf(k);return words.every(w=>hay.includes(w)||near(w,hay))});close=rows.length>0}
    if(words.length){const inName=k=>words.every(w=>k.n.toLowerCase().includes(w))?0:1;rows=rows.slice().sort((a,b)=>inName(a)-inName(b))}
    renderCards(rows);
    if(close)document.getElementById('count').textContent='Nothing spelled exactly like that. '+rows.length+' close matches';
  }
  q.addEventListener('input',draw);c.addEventListener('change',()=>{type='';draw()});draw();
}
function roomView(){
  document.title='Room view · IDeATe Lending';
  const placed=ROOM.units.filter(u=>u.rect);
  app.innerHTML='<a class="back" href="./">← All items</a><h1>Explore the lending room</h1><p class="intro">A top view of the Room Locator layout and shelves. '+esc(ROOM.synced&&ROOM.synced.at?'Shelves as the console in Lending had them on '+new Date(ROOM.synced.at).toLocaleDateString([], {month:'long',day:'numeric'})+'.':'Shelves as of the Nov 16 setup.')+' It shows where things live, not whether they are checked out.</p><div class="room-layout"><div class="room-map" aria-label="Top view of lending room">'+placed.map(u=>'<button type="button" class="room-unit" data-unit="'+esc(u.code)+'" style="left:'+(u.rect[0]/2)+'%;top:'+(u.rect[1]/1.5)+'%;width:'+Math.max(5,(u.rect[2]-u.rect[0])/2)+'%;height:'+Math.max(5,(u.rect[3]-u.rect[1])/1.5)+'%"'+((u.rect[3]-u.rect[1])/1.5>(u.rect[2]-u.rect[0])/2*1.4?' data-tall':'')+'><span>'+esc(u.name)+'</span></button>').join('')+'</div><div id="room-detail" class="room-detail"><h2>Choose a unit</h2><p>Tap a unit on the map to see its shelves and what is on each.</p></div></div><p class="note room-note">Shelves are numbered from the bottom: shelf 1 is the lowest. In Lending, the console lights the exact shelf when you look an item up.</p>';
  app.querySelectorAll('.room-unit').forEach(button=>button.addEventListener('click',()=>{
    const unit=ROOM.units.find(u=>u.code===button.dataset.unit),detail=document.getElementById('room-detail');
    app.querySelectorAll('.room-unit').forEach(b=>b.classList.toggle('selected',b===button));
    const shelves=new Map();
    for(let s=1;s<=unit.shelves;s++)if(unit.boards.includes(s))shelves.set(s,[]);
    K.filter(k=>k.u===unit.code).forEach(k=>{const support=unit.boards.filter(b=>b<=k.s).at(-1)||k.s;if(!shelves.has(support))shelves.set(support,[]);shelves.get(support).push(k)});
    detail.innerHTML='<h2>'+esc(unit.name)+'</h2><p>'+unit.boards.length+(unit.boards.length===1?' shelf':' shelves')+', top shelf first</p>'+[...shelves.entries()].sort((a,b)=>b[0]-a[0]).map(([s,items])=>'<div class="room-shelf"><h3>Shelf '+s+'</h3>'+(items.length?items.map(k=>'<a href="#k'+K.indexOf(k)+'">'+esc(k.n)+'</a>').join(''):'<p>No listed items</p>')+'</div>').join('');
  }));
}
function route(){if(!DATA)return;const hash=decodeURIComponent(location.hash.slice(1));const query=new URLSearchParams(location.search).get('i');let k;
  if(/^k\d+$/.test(hash))k=K[Number(hash.slice(1))];
  else if(query&&!hash)k=K.find(x=>x.h===query.toLowerCase());
  if(k)itemView(k,!!(query&&!hash));else if(hash==='room')roomView();else if(hash.startsWith('t')){const [c,t]=hash.slice(1).split('/');listing(c,t)}else listing();
  window.scrollTo(0,0);
}
Promise.all([fetch('data.json?v=20261116a').then(r=>{if(!r.ok)throw Error('Inventory unavailable');return r.json()}),fetch('photos.json?v=20261116h').then(r=>r.ok?r.json():{}).catch(()=>({})),fetch('room.json?v=20261116a').then(r=>r.ok?r.json():{units:[]}).catch(()=>({units:[]}))]).then(([data,photos,room])=>{DATA=data;K=data.kinds;PHOTO=photos;ROOM=room;route();addEventListener('hashchange',route)}).catch(()=>{app.innerHTML='<h1>Item guide unavailable</h1><p>Please try reloading this page.</p>'});
