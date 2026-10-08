# PACMAN – Grand Theft Edition (Commodore 64)

Pac-Man for the C64 where the four ghosts are replaced by a GTA-style wanted list:

| Enemy   | Nickname | Behaviour (classic ghost AI)                      |
|---------|----------|---------------------------------------------------|
| Officer | BADGE    | chases you directly                               |
| Cruiser | SIREN    | cuts you off 4 tiles ahead                        |
| Chopper | BLADES   | flanks you, mirrored around the officer           |
| Tank    | TREADS   | chases until close, then backs off to its corner  |

Grab the flashing green **$ cash** to scare them (they turn blue), then bust them for 200/400/800/1600.
The HUD's WANTED stars rise with each level, and a police siren plays in the background. You get an extra life at 10,000.

## Run in GTK3VICE

* Drag `build/pacman.d64` onto the VICE window (autostart), **or**
* *File → Attach disk image → Drive 8*, then type `LOAD"*",8,1` and `RUN`.

Controls: joystick in **port 2** (in VICE: *Settings → Input → Joystick*, map a keyset or gamepad to port 2),
or keyboard **W A S D** to move and **SPACE** to start.

## Build

Requires only Node.js (no external assembler):

```
node tools/build.js      # -> build/pacman.prg, build/pacman.d64
node tools/test.js       # smoke test in the bundled 6502 emulator
node tools/test2.js clear 12000   # bot clears levels
```

* `src/pacman.asm` – the game (6502 assembly)
* `tools/build.js` – maze, wall glyphs, sprite art, tables; assembles and writes the PRG/D64
* `tools/asm.js` / `tools/d64.js` – minimal 6502 assembler and D64 writer
* `tools/emu.js` – tiny 6502/C64 harness used by the tests

The sprite art is original, GTA-inspired pixel art. It does not use any artwork from the GTA games.
