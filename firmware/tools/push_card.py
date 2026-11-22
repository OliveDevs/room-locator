# Sends the SD card files to the Room Locator over USB, so the card never has to come out of the console.
#   python3 push_card.py                  sends every .TSV in "SD card files" next to this script
#   python3 push_card.py some/folder      sends every .TSV in that folder
#   python3 push_card.py KINDS.TSV        sends just that file (or several)
# Sending a folder skips STAFF.TSV and BOARDS.TSV, because the console changes those itself (a new PIN, boards taken out)
# and an old copy would undo that. Name them one by one if you really mean to replace them.
# Close the Arduino Serial Monitor first: only one program can use the port.
# Same-named files on the card are replaced; nothing else on the card is touched. MOVES.TSV is never sent.
import os, sys, time, select, termios, glob

ORDER = ['UNITS.TSV', 'BOARDS.TSV', 'STAFF.TSV', 'TYPES.TSV', 'CODES.TSV', 'KINDS.TSV']   # KINDS last: the console reloads when it arrives

def find_port():
    if os.environ.get('RL_PORT'): return os.environ['RL_PORT']
    ports = sorted(glob.glob('/dev/cu.usbmodem*') + glob.glob('/dev/ttyACM*'))
    if not ports: sys.exit('No Arduino found. Is the USB cable in?')
    return ports[0]

def pick_files(args):
    here = os.path.dirname(os.path.abspath(__file__))
    if not args: args = [os.path.join(here, 'SD card files')]
    files = []
    for a in args:
        if os.path.isdir(a):
            for n in sorted(os.listdir(a)):
                if not n.upper().endswith('.TSV'): continue
                if n.upper() in ('STAFF.TSV', 'BOARDS.TSV'): print(f'Skipping {n}: the console keeps its own (name it on its own to replace it)'); continue
                files.append(os.path.join(a, n))
        elif os.path.isfile(a): files.append(a)
        else: sys.exit('Not found: ' + a)
    files = [f for f in files if os.path.basename(f).upper() != 'MOVES.TSV']
    for f in files:
        n = os.path.basename(f)
        if len(n) > 12 or n.upper() != n: sys.exit(n + ': card file names must be capitals, 8 letters at most, like KINDS.TSV')
    rank = lambda f: ORDER.index(os.path.basename(f)) if os.path.basename(f) in ORDER else len(ORDER) - 1
    return sorted(files, key=rank)

class Port:
    def __init__(self, path):
        try: self.fd = os.open(path, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
        except OSError as e: sys.exit(f'Could not open {path} ({e.strerror}). Close the Serial Monitor and try again.')
        a = termios.tcgetattr(self.fd); a[0] = 0; a[1] = 0; a[2] = termios.CS8 | termios.CREAD | termios.CLOCAL; a[3] = 0
        a[4] = a[5] = termios.B115200
        termios.tcsetattr(self.fd, termios.TCSANOW, a)
        self.buf = b''
    def write(self, b):
        while b:
            try: n = os.write(self.fd, b); b = b[n:]
            except BlockingIOError: time.sleep(0.005)
    def read_some(self, wait):
        r, _, _ = select.select([self.fd], [], [], wait)
        if r:
            try: self.buf += os.read(self.fd, 4096)
            except (BlockingIOError, OSError): pass
    def wait_for(self, tok, seconds):
        end = time.time() + seconds
        while time.time() < end:
            i = self.buf.find(tok)
            if i >= 0: self.buf = self.buf[i + len(tok):]; return True
            self.read_some(0.02)
        return False

def main():
    files = pick_files(sys.argv[1:])
    if not files: sys.exit('No .TSV files to send.')
    path = find_port(); print('Console on', path)
    p = Port(path)
    print('Waiting for it to start (opening the port restarts the Mega)...')
    time.sleep(float(os.environ.get('RL_BOOT_WAIT', 7)))
    p.read_some(0.1); p.buf = b''
    p.write(b'@\n')
    if not p.wait_for(b'@ROOMLOCATOR', 5): sys.exit('The console did not answer. Is the Room Locator firmware on it?')
    p.wait_for(b'\n', 1); print('Console answered.')
    for f in files:
        name = os.path.basename(f); data = open(f, 'rb').read()
        p.write(f'@PUT {name} {len(data)}\n'.encode())
        if not p.wait_for(b'K\r\n', 8):
            err = p.buf.decode('latin1').strip(); sys.exit(f'{name}: the console said no. {err}')
        sent = 0
        while sent < len(data):
            chunk = data[sent:sent + 60]; p.write(chunk); sent += len(chunk)
            if sent < len(data) and not p.wait_for(b'K\r\n', 8): sys.exit(f'{name}: stopped at byte {sent} of {len(data)}. Try again.')
            if sent % 3000 < 60: print(f'\r  {name:12} {sent * 100 // len(data):3d}%', end='', flush=True)
        if not p.wait_for(b'@OK', 15): sys.exit(f'\n{name}: the console did not confirm it. Try again.')
        print(f'\r  {name:12} done ({len(data)} bytes)')
        time.sleep(0.3)
    print('All sent. The console is back on Home.')
    print('Changes made at the console (MOVES.TSV) are still on the card and still apply on top of these files.')
    print('If you ran apply_moves.py and fold_added.py first, those changes are already in the files: type @CLEARMOVES in the Serial Monitor.')

if __name__ == '__main__': main()
