# PACMAN – Grand Theft Edition (Commodore 64)

Pac-Man for the C64 where the four ghosts are replaced by a GTA-style wanted list:

| Enemy   | Nickname | Behaviour (classic ghost AI)                      |
|---------|----------|---------------------------------------------------|
| Officer | BADGE    | chases you directly                               |
| Cruiser | SIREN    | cuts you off 4 tiles ahead                        |
| Chopper | BLADES   | flanks you, mirrored around the officer           |
| Tank    | TREADS   | chases until close, then backs off to its corner  |

Grab the flashing green **$ cash** to scare them (they turn blue), then bust them for 200/400/800/1600.
The HUD's WANTED stars rise with each level. You get an extra life at 10,000.

During play a laid-back GTA-style groove, **"Grove Street Cruise"** (original, D minor), runs on SID voices 1 and 2. It has drums, a filtered bass, chord stabs and a lead hook. Voice 3 is kept for the waka and the other sound effects so they always cut through. The music stops when you get busted and starts again on the next life or level.

## Intro & music

The game boots into a **BBTG Vibathon Group 2026** cracktro in the style of the old scene groups:

* a big colour-cycling BBTG logo with a drop shadow,
* sine-moving raster bars across the border and background,
* a copper band behind the group name,
* a smooth-scrolling message line.

The soundtrack is an original G-funk style tune for the SID. It opens with a police-siren wail and pushes the chip hard:

* drum sounds built from wavetables (noise and pulse),
* resonant filter sweeps on the bass,
* PWM chord arpeggios,
* a vibrato "whistle" lead and an oscillator-sync lead.

Next comes a **GTA-style intro**:

1. "BBTG Vibathon Group presents" fades in and out.
2. A Vice City sunset rises and the skyline with palm trees and lit windows comes up.
3. A big stacked **GRAND / THEFT / PAC-MAN** logo slams in with a white flash.
4. Five wanted stars light up one by one, then the border flashes red and blue like police lights and a police chopper crosses the sky.

The music keeps playing through both intros and the title screen. Press fire or space to skip ahead.

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
