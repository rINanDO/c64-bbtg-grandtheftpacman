; =====================================================================
;  PACMAN - GRAND THEFT EDITION            for the Commodore 64
;  The ghosts have been replaced by a GTA-style wanted list:
;  an officer, a police cruiser, a police chopper and an army tank.
;  Grab the cash ($) to turn the tables and bust them back.
;
;  Controls: joystick in port 2, or W A S D + SPACE
;  Build:    node tools/build.js   ->  build/pacman.d64
; =====================================================================

; ------------------------------------------------------------ hardware
SCREEN   = $0400
COLRAM   = $d800
CHARSET  = $3000
SPRPTR   = $07f8

; ------------------------------------------------------------ constants
CH_SPACE = $20
CH_DOT   = $40
CH_POWER = $41
CH_DOOR  = $42                 ; codes >= CH_DOOR are solid
CH_LIFE  = $43
CH_STAR  = $44

DIR_UP    = 0
DIR_LEFT  = 1
DIR_DOWN  = 2
DIR_RIGHT = 3

ST_HOUSE = 0
ST_LEAVE = 1
ST_ACTIVE = 2

MAXPX    = 208                 ; 26*8 = right-most column
HOUSE_X  = 104                 ; door column 13 * 8
EXIT_Y   = 64                  ; row 8 * 8 (just above the door)
HOME_Y   = 84                  ; inside the house

SPR_PAC    = $e0
SPR_ENEMY  = $e9
SPR_FRIGHT = $f1
SPR_DEATH  = $f3

SFX_POWER = 0
SFX_EAT   = 1
SFX_DEATH = 2
SFX_EXTRA = 3
SFX_START = 4

; ------------------------------------------------------------ zero page
tmp0     = $02
tmp1     = $03
tmp2     = $04
tmp3     = $05
tmp4     = $06
tmp5     = $07
ptr0     = $08
ptr1     = $0a
ptr2     = $0c
ptr3     = $0e
frame    = $10
cellx    = $11
celly    = $12
nx       = $13
ny       = $14
tx       = $15
ty       = $16
bestd    = $17                 ; 2 bytes
bestdir  = $19
rnd      = $1a
joy      = $1b
wantdir  = $1c
mode     = $1d                 ; 0 scatter, 1 chase
modephase = $1e
modet    = $1f                 ; 2 bytes
frt      = $21                 ; 2 bytes, fright timer
chain    = $23
died     = $24
lives    = $25
level    = $26
levelbcd = $27
dots     = $28                 ; 2 bytes
scorechg = $2a
pacanim  = $2b
pacmove  = $2c
bonus    = $2d
spd_pac  = $2e
spd_en   = $2f
spd_fr   = $30
spd_tun  = $31
wakat    = $32
wakaf    = $33
sfxt     = $34
sfxlo    = $35
sfxhi    = $36
sfxdl    = $37
sfxdh    = $38
sfxwave  = $39
dist     = $3a                 ; 2 bytes
addmid   = $3c
savex    = $3d
wcount   = $3e
; entity tables, index 0 = pacman, 1-4 = the wanted list
ex       = $40
ey       = $45
edir     = $4a
eacc     = $4f
estate   = $54
etimer   = $59
efright  = $5e
eptr     = $63
ecol     = $68
score    = $70                 ; 3 bytes BCD, low first
hiscore  = $73                 ; 3 bytes BCD
gmusic   = $76                 ; in-game music playing

; ------------------------------------------------------------ BASIC stub: 10 SYS2061
        .org $0801
        .word basend, 10
        .byte $9e
        .text "2061"
        .byte 0
basend: .word 0

; =====================================================================
start:
        sei
        cld
        ldx #$ff
        txs
        lda #$7f
        sta $dc0d
        sta $dd0d
        lda $dc0d
        lda $dd0d
        lda #<nmi_rti
        sta $0318
        lda #>nmi_rti
        sta $0319
        lda #$37
        sta $01
        lda #$ff
        sta $dc02
        lda #0
        sta $dc03
        lda #$7f
        sta $dc00

        jsr init_charset
        jsr init_sid
        lda #0
        sta hiscore
        sta hiscore+1
        sta hiscore+2
        lda $d012
        ora #1
        sta rnd

        lda #0
        sta $d020
        sta $d021
        sta $d010
        sta $d017
        sta $d01d
        sta $d01b
        lda #$1c                ; screen $0400, charset $3000
        sta $d018
        lda #$1b
        sta $d011
        lda #$08
        sta $d016
        lda #$1e                ; sprites 1-4 multicolour
        sta $d01c
        lda #1
        sta $d025
        lda #10
        sta $d026

        jsr intro_bbtg
        jsr intro_gta
main_loop:
        jsr title_screen
        jsr new_game
        jmp main_loop

nmi_rti:
        rti

; =====================================================================
;  setup helpers
; =====================================================================
init_charset:
        lda #$33                ; char ROM visible at $d000
        sta $01
        ldx #0
@rom:   lda $d000,x
        sta CHARSET,x
        lda $d100,x
        sta CHARSET+$100,x
        lda $d200,x
        sta CHARSET+$200,x
        lda $d300,x
        sta CHARSET+$300,x
        inx
        bne @rom
        lda #$37
        sta $01
        lda #<glyphs            ; custom glyphs for chars $40-$ff
        sta ptr0
        lda #>glyphs
        sta ptr0+1
        lda #<[CHARSET+$200]
        sta ptr1
        lda #>[CHARSET+$200]
        sta ptr1+1
        ldx #6
        ldy #0
@cp:    lda (ptr0),y
        sta (ptr1),y
        iny
        bne @cp
        inc ptr0+1
        inc ptr1+1
        dex
        bne @cp
        rts

init_sid:
        ldx #$18
        lda #0
@clr:   sta $d400,x
        dex
        bpl @clr
        lda #$0f
        sta $d418
        lda #$08                ; pulse width for the effects voice (3)
        sta $d411
        lda #0
        sta gmusic
        rts

clear_screen:
        ldx #0
@l:     lda #CH_SPACE
        sta SCREEN,x
        sta SCREEN+$100,x
        sta SCREEN+$200,x
        sta SCREEN+$2e8,x
        lda #1
        sta COLRAM,x
        sta COLRAM+$100,x
        sta COLRAM+$200,x
        sta COLRAM+$2e8,x
        inx
        bne @l
        lda #0
        sta $d015
        rts

; wait for raster line 250 (bottom border), once per frame
wait_frame:
@w1:    lda $d012
        cmp #250
        beq @w1
@w2:    lda $d012
        cmp #250
        bne @w2
        inc frame
        rts

; A = number of frames to wait while keeping sound/animation alive
wait_frames:
        sta wcount
@l:     jsr wait_frame
        jsr sound_tick
        jsr flash_power
        dec wcount
        bne @l
        rts

random:
        lda rnd
        asl
        bcc @n
        eor #$1d
@n:     sta rnd
        rts

; ptr0 -> list of [col,row,colour,"text",0] ... $ff
print_list:
        ldy #0
        lda (ptr0),y
        cmp #$ff
        bne @go
        rts
@go:    sta tmp0
        iny
        lda (ptr0),y
        tax
        iny
        lda (ptr0),y
        sta tmp1
        lda scrlo,x
        clc
        adc tmp0
        sta ptr1
        sta ptr2
        lda scrhi,x
        adc #0
        sta ptr1+1
        clc
        adc #>[COLRAM-SCREEN]
        sta ptr2+1
        lda ptr0
        clc
        adc #3
        sta ptr0
        bcc @nc
        inc ptr0+1
@nc:    ldy #0
@ch:    lda (ptr0),y
        beq @end
        sta (ptr1),y
        lda tmp1
        sta (ptr2),y
        iny
        bne @ch
@end:   iny
        tya
        clc
        adc ptr0
        sta ptr0
        bcc print_list
        inc ptr0+1
        jmp print_list

; A = BCD byte -> two digits at (ptr1),y ; y += 2
print_bcd:
        pha
        lsr
        lsr
        lsr
        lsr
        ora #$30
        sta (ptr1),y
        iny
        pla
        and #$0f
        ora #$30
        sta (ptr1),y
        iny
        rts

; =====================================================================
;  title screen
; =====================================================================
title_screen:
        jsr clear_screen
        jsr music_start
        lda #<title_text
        sta ptr0
        lda #>title_text
        sta ptr0+1
        jsr print_list
        lda #<[SCREEN+21]
        sta ptr1
        lda #>[SCREEN+21]
        sta ptr1+1
        ldy #0
        lda hiscore+2
        jsr print_bcd
        lda hiscore+1
        jsr print_bcd
        lda hiscore
        jsr print_bcd

        ldx #4
@init:  lda title_ex,x
        sta ex,x
        lda title_ey,x
        sta ey,x
        lda #ST_ACTIVE
        sta estate,x
        lda #0
        sta efright,x
        lda #DIR_RIGHT
        sta edir,x
        dex
        bpl @init
        lda #0
        sta frt
        sta frt+1
        lda #1
        sta pacmove
        jsr set_anim
        jsr update_sprites
        lda #$1f
        sta $d015

@rel:   jsr wait_frame          ; wait until fire is released
        jsr music_play
        jsr read_input
        lda joy
        and #$10
        bne @rel
@loop:  jsr wait_frame
        jsr music_play
        jsr random
        jsr set_anim
        jsr update_sprites
        lda frame               ; police-light colour cycle on the subtitle
        lsr
        lsr
        lsr
        and #1
        tax
        lda siren_cols,x
        ldx #26
@cc:    sta COLRAM+4*40+6,x
        dex
        bpl @cc
        jsr read_input
        lda joy
        and #$10
        beq @loop
        rts

siren_cols:
        .byte 2, 14

title_ex:
        .byte 56, 56, 56, 56, 56
title_ey:
        .byte 40, 72, 96, 120, 144

title_text:
        .byte 12,0,12
        .scr "HI-SCORE",0
        .byte 14,2,7
        .scr "P A C M A N",0
        .byte 6,4,2
        .scr "*** GRAND THEFT EDITION ***",0
        .byte 10,6,7
        .scr "YOU - THE GETAWAY KING",0
        .byte 7,8,1
        .scr "-- THEY WANT YOU BUSTED --",0
        .byte 10,10,14
        .scr "OFFICER    'BADGE'",0
        .byte 10,13,14
        .scr "CRUISER    'SIREN'",0
        .byte 10,16,3
        .scr "CHOPPER    'BLADES'",0
        .byte 10,19,5
        .scr "TANK       'TREADS'",0
        .byte 4,21,5
        .scr "$ GRAB CASH TO TURN THE TABLES $",0
        .byte 3,23,12
        .scr "JOYSTICK PORT 2 OR W A S D + SPACE",0
        .byte 6,24,1
        .scr "PRESS FIRE OR SPACE TO START",0
        .byte $ff

; =====================================================================
;  game flow
; =====================================================================
new_game:
        jsr init_sid            ; music off, game sound effects on
        lda #0
        sta music_on
        lda #0
        sta score
        sta score+1
        sta score+2
        sta bonus
        lda #3
        sta lives
        lda #1
        sta level
        sta levelbcd
        jsr start_level
        jmp game_loop

start_level:
        jsr clear_screen
        jsr draw_maze
        jsr draw_hud
        lda #<TOTAL_DOTS
        sta dots
        lda #>TOTAL_DOTS
        sta dots+1
        jsr set_speeds
        jsr reset_actors
        jsr game_music
        jmp ready_pause

set_speeds:
        ldx level
        dex
        cpx #4
        bcc @ok
        ldx #3
@ok:    lda pac_speeds,x
        sta spd_pac
        lda en_speeds,x
        sta spd_en
        lda #130
        sta spd_fr
        lda #110
        sta spd_tun
        rts

pac_speeds:
        .byte 228, 238, 246, 250
en_speeds:
        .byte 205, 220, 234, 242

reset_actors:
        ldx #4
@l:     lda start_ex,x
        sta ex,x
        lda start_ey,x
        sta ey,x
        lda start_dir,x
        sta edir,x
        lda start_state,x
        sta estate,x
        lda start_timer,x
        sta etimer,x
        lda #0
        sta efright,x
        sta eacc,x
        dex
        bpl @l
        lda #DIR_LEFT
        sta wantdir
        lda #0
        sta frt
        sta frt+1
        sta died
        sta mode
        sta modephase
        sta pacanim
        sta pacmove
        lda mode_lo
        sta modet
        lda mode_hi
        sta modet+1
        jsr set_anim
        jsr update_sprites
        lda #$1f
        sta $d015
        rts

start_ex:    .byte 104, 104, 104,  88, 120
start_ey:    .byte 136,  64,  84,  84,  84
start_dir:   .byte DIR_LEFT, DIR_LEFT, DIR_UP, DIR_UP, DIR_UP
start_state: .byte ST_ACTIVE, ST_ACTIVE, ST_HOUSE, ST_HOUSE, ST_HOUSE
start_timer: .byte 0, 0, 30, 120, 220

; scatter/chase schedule (frames @50Hz)
mode_lo: .byte <350, <1000, <350, <1000, <250, <1000, <250, 0
mode_hi: .byte >350, >1000, >350, >1000, >250, >1000, >250, 0

READY_POS = SCREEN + 14*40 + 10

ready_pause:
        ldx #5
@p:     lda ready_txt,x
        sta READY_POS,x
        lda #7
        sta READY_POS+COLRAM-SCREEN,x
        dex
        bpl @p
        lda #SFX_START
        jsr play_sfx
        lda #120
        jsr wait_frames
        ldx #5
        lda #CH_SPACE
@e:     sta READY_POS,x
        dex
        bpl @e
        rts

ready_txt:
        .scr "READY!"
over_txt:
        .scr "GAME  OVER"
busted_txt:
        .scr " BUSTED! "

game_loop:
@frame: jsr wait_frame
        jsr update_sprites
        lda scorechg
        beq @nos
        jsr print_score
        lda #0
        sta scorechg
@nos:   jsr read_input
        jsr flash_power
        jsr sound_tick
        jsr update_modes
        jsr move_pac
        ldx #1
@en:    jsr move_enemy
        inx
        cpx #5
        bne @en
        jsr check_collisions
        jsr set_anim
        lda died
        bne @death
        lda dots
        ora dots+1
        beq @clear
        jmp @frame

@death: jsr death_seq
        dec lives
        jsr draw_lives
        lda lives
        beq @over
        jsr reset_actors
        jsr game_music
        jsr ready_pause
        jmp @frame

@clear: jsr level_clear
        inc level
        sed
        lda levelbcd
        clc
        adc #1
        sta levelbcd
        cld
        jsr start_level
        jmp @frame

@over:  ldx #9
@ot:    lda over_txt,x
        sta READY_POS-1,x
        lda #2
        sta READY_POS-1+COLRAM-SCREEN,x
        dex
        bpl @ot
        jsr update_hiscore
        lda #0
        sta $d015
        lda #200
        jmp wait_frames

update_hiscore:
        lda score+2
        cmp hiscore+2
        bcc @no
        bne @yes
        lda score+1
        cmp hiscore+1
        bcc @no
        bne @yes
        lda score
        cmp hiscore
        bcc @no
@yes:   lda score
        sta hiscore
        lda score+1
        sta hiscore+1
        lda score+2
        sta hiscore+2
@no:    rts

death_seq:
        jsr music_stop
        ldx #8                  ; show "BUSTED!" on the HUD line under the house
@bt:    lda busted_txt,x
        sta READY_POS-2,x
        lda #2
        sta READY_POS-2+COLRAM-SCREEN,x
        dex
        bpl @bt
        lda #50
        jsr wait_frames
        lda #$01                ; only pacman left
        sta $d015
        lda #SFX_DEATH
        jsr play_sfx
        lda #0
        sta tmp5
@d:     lda tmp5
        clc
        adc #SPR_DEATH
        sta SPRPTR
        lda #9
        jsr wait_frames
        inc tmp5
        lda tmp5
        cmp #8
        bne @d
        lda #0
        sta $d015
        lda #40
        jsr wait_frames
        ldx #8
        lda #CH_SPACE
@cl:    sta READY_POS-2,x
        dex
        bpl @cl
        rts

level_clear:
        jsr music_stop
        lda #50
        jsr wait_frames
        lda #$01
        sta $d015
        lda #8
        sta tmp5
@f:     lda #1
        jsr set_wall_color
        lda #10
        jsr wait_frames
        lda #6
        jsr set_wall_color
        lda #10
        jsr wait_frames
        dec tmp5
        bne @f
        rts

; A = colour for every wall cell of the maze
set_wall_color:
        sta tmp4
        ldx #0
@r:     lda scrlo+1,x
        sta ptr1
        sta ptr2
        lda scrhi+1,x
        sta ptr1+1
        clc
        adc #>[COLRAM-SCREEN]
        sta ptr2+1
        ldy #26
@c:     lda (ptr1),y
        cmp #CH_WALL0
        bcc @n
        lda tmp4
        sta (ptr2),y
@n:     dey
        bpl @c
        inx
        cpx #23
        bne @r
        rts

; =====================================================================
;  maze & HUD drawing
; =====================================================================
draw_maze:
        lda #<maze_chars
        sta ptr0
        lda #>maze_chars
        sta ptr0+1
        lda #<maze_cols
        sta ptr3
        lda #>maze_cols
        sta ptr3+1
        ldx #0
@row:   lda scrlo+1,x
        sta ptr1
        sta ptr2
        lda scrhi+1,x
        sta ptr1+1
        clc
        adc #>[COLRAM-SCREEN]
        sta ptr2+1
        ldy #26
@col:   lda (ptr0),y
        sta (ptr1),y
        lda (ptr3),y
        sta (ptr2),y
        dey
        bpl @col
        lda ptr0
        clc
        adc #27
        sta ptr0
        bcc @a
        inc ptr0+1
@a:     lda ptr3
        clc
        adc #27
        sta ptr3
        bcc @b
        inc ptr3+1
@b:     inx
        cpx #23
        bne @row
        rts

draw_hud:
        lda #<hud_text
        sta ptr0
        lda #>hud_text
        sta ptr0+1
        jsr print_list
        jsr print_score
        lda #<[SCREEN+10*40+29]
        sta ptr1
        lda #>[SCREEN+10*40+29]
        sta ptr1+1
        ldy #0
        lda hiscore+2
        jsr print_bcd
        lda hiscore+1
        jsr print_bcd
        lda hiscore
        jsr print_bcd
        lda #<[SCREEN+13*40+29]
        sta ptr1
        lda #>[SCREEN+13*40+29]
        sta ptr1+1
        ldy #0
        lda levelbcd
        jsr print_bcd
        jsr draw_lives
        jmp draw_stars

print_score:
        lda #<[SCREEN+7*40+29]
        sta ptr1
        lda #>[SCREEN+7*40+29]
        sta ptr1+1
        ldy #0
        lda score+2
        jsr print_bcd
        lda score+1
        jsr print_bcd
        lda score
        jmp print_bcd

LIVES_POS = SCREEN + 16*40 + 29
draw_lives:
        lda lives
        beq @z
        sec
        sbc #1
@z:     sta tmp4                ; spare lives shown
        ldy #0
@l:     lda #CH_SPACE
        cpy tmp4
        bcs @put
        lda #CH_LIFE
@put:   sta LIVES_POS,y
        lda #7
        sta LIVES_POS+COLRAM-SCREEN,y
        iny
        cpy #8
        bne @l
        rts

STARS_POS = SCREEN + 19*40 + 29
draw_stars:                     ; wanted level = current level (max 5)
        lda level
        cmp #6
        bcc @ok
        lda #5
@ok:    sta tmp4
        ldx #0
        ldy #0
@l:     lda #CH_STAR
        sta STARS_POS,y
        lda #11
        cpx tmp4
        bcs @c
        lda #7
@c:     sta STARS_POS+COLRAM-SCREEN,y
        iny
        iny
        inx
        cpx #5
        bne @l
        rts

hud_text:
        .byte 30,1,7
        .scr "PACMAN",0
        .byte 28,2,10
        .scr "GRAND THEFT",0
        .byte 30,3,10
        .scr "EDITION",0
        .byte 29,6,1
        .scr "SCORE",0
        .byte 29,7,7
        .scr "000000",0
        .byte 29,9,1
        .scr "HIGH",0
        .byte 29,10,7
        .scr "000000",0
        .byte 29,12,1
        .scr "LEVEL",0
        .byte 29,13,7
        .scr "00",0
        .byte 29,15,1
        .scr "LIVES",0
        .byte 29,18,1
        .scr "WANTED",0
        .byte 29,22,12
        .scr "JOY PORT 2",0
        .byte 29,23,12
        .scr "OR W A S D",0
        .byte $ff

; flashing cash pellets: swap glyph $41 on/off
flash_power:
        ldx #7
        lda frame
        and #$10
        beq @on
        lda #0
@off:   sta CHARSET+CH_POWER*8,x
        dex
        bpl @off
        rts
@on:    lda glyphs+8,x
        sta CHARSET+CH_POWER*8,x
        dex
        bpl @on
        rts

; =====================================================================
;  input: joystick port 2 + keyboard W A S D SPACE
;  joy bits: 0 up, 1 down, 2 left, 3 right, 4 fire
; =====================================================================
read_input:
        lda #$fd                ; column PA1: W(PB1) A(PB2) S(PB5)
        sta $dc00
        lda $dc01
        eor #$ff
        sta tmp0
        lda #$fb                ; column PA2: D(PB2)
        sta $dc00
        lda $dc01
        eor #$ff
        sta tmp1
        lda #$7f                ; column PA7: SPACE(PB4)
        sta $dc00
        lda $dc01
        eor #$ff
        sta tmp2
        lda #$7f
        sta $dc00
        lda $dc00
        and #$1f
        eor #$1f
        sta joy
        lda tmp0
        and #$02
        beq @k1
        lda #$01
        jsr @set
@k1:    lda tmp0
        and #$20
        beq @k2
        lda #$02
        jsr @set
@k2:    lda tmp0
        and #$04
        beq @k3
        lda #$04
        jsr @set
@k3:    lda tmp1
        and #$04
        beq @k4
        lda #$08
        jsr @set
@k4:    lda tmp2
        and #$10
        beq @k5
        lda #$10
        jsr @set
@k5:    ; translate to wanted direction (kept while nothing pressed)
        lda joy
        lsr
        bcc @d1
        ldx #DIR_UP
        stx wantdir
@d1:    lsr
        bcc @d2
        ldx #DIR_DOWN
        stx wantdir
@d2:    lsr
        bcc @d3
        ldx #DIR_LEFT
        stx wantdir
@d3:    lsr
        bcc @d4
        ldx #DIR_RIGHT
        stx wantdir
@d4:    rts
@set:   ora joy
        sta joy
        rts

; =====================================================================
;  movement
; =====================================================================
dxt:    .byte 0, -1, 0, 1
dyt:    .byte -1, 0, 1, 0
dx2:    .byte 0, -2, 0, 2
dy2:    .byte -2, 0, 2, 0
dx4:    .byte 0, -4, 0, 4
dy4:    .byte -4, 0, 4, 0

; A = direction, uses cellx/celly. Returns nx/ny and A = tile there.
; Preserves X.
neighbor_tile:
        tay
        lda cellx
        clc
        adc dxt,y
        sta nx
        lda celly
        clc
        adc dyt,y
        sta ny
        lda nx
        cmp #27
        bcs @out                ; off the side: tunnel
        ldy ny
        lda scrlo+1,y
        sta ptr3
        lda scrhi+1,y
        sta ptr3+1
        ldy nx
        lda (ptr3),y
        rts
@out:   lda #CH_SPACE
        rts

; move entity X one pixel in its direction (with tunnel wrap)
move_px:
        lda edir,x
        beq @up
        cmp #DIR_LEFT
        beq @left
        cmp #DIR_DOWN
        beq @down
        lda ex,x                ; right
        cmp #MAXPX
        bne @ir
        lda #0
        sta ex,x
        rts
@ir:    inc ex,x
        rts
@left:  lda ex,x
        bne @dl
        lda #MAXPX
        sta ex,x
        rts
@dl:    dec ex,x
        rts
@up:    dec ey,x
        rts
@down:  inc ey,x
        rts

move_pac:
        lda #0
        sta pacmove
        lda eacc
        clc
        adc spd_pac
        sta eacc
        bcc @r
        lda ex
        ora ey
        and #7
        bne @mid
        lda ex                  ; at a tile centre: may turn
        lsr
        lsr
        lsr
        sta cellx
        lda ey
        lsr
        lsr
        lsr
        sta celly
        lda wantdir
        jsr neighbor_tile
        cmp #CH_DOOR
        bcs @keep
        lda wantdir
        sta edir
@keep:  lda edir
        jsr neighbor_tile
        cmp #CH_DOOR
        bcs @r                  ; blocked: stand still
        bcc @go
@mid:   lda wantdir             ; between tiles only reversing is allowed
        eor #2
        cmp edir
        bne @go
        lda wantdir
        sta edir
@go:    ldx #0
        jsr move_px
        inc pacmove
        lda ex
        ora ey
        and #7
        bne @r
        jmp eat_check
@r:     rts

eat_check:
        lda ex
        lsr
        lsr
        lsr
        sta nx
        lda ey
        lsr
        lsr
        lsr
        tay
        lda scrlo+1,y
        sta ptr3
        lda scrhi+1,y
        sta ptr3+1
        ldy nx
        lda (ptr3),y
        cmp #CH_DOT
        beq @dot
        cmp #CH_POWER
        beq @pow
        rts
@dot:   lda #CH_SPACE
        sta (ptr3),y
        jsr dec_dots
        lda #$10
        ldy #0
        jsr add_score
        jmp waka
@pow:   lda #CH_SPACE
        sta (ptr3),y
        jsr dec_dots
        lda #$50
        ldy #0
        jsr add_score
        jmp start_fright

dec_dots:
        lda dots
        bne @a
        dec dots+1
@a:     dec dots
        rts

; A = BCD to add to score (tens), Y = BCD to add to score+1 (hundreds)
add_score:
        sty addmid
        sed
        clc
        adc score
        sta score
        lda score+1
        adc addmid
        sta score+1
        lda score+2
        adc #0
        sta score+2
        cld
        lda #1
        sta scorechg
        lda bonus               ; extra life at 10000
        bne @r
        lda score+2
        beq @r
        inc bonus
        inc lives
        stx savex
        jsr draw_lives
        lda #SFX_EXTRA
        jsr play_sfx
        ldx savex
@r:     rts

start_fright:
        ldx level
        dex
        cpx #8
        bcc @ok
        ldx #7
@ok:    lda fr_lo,x
        sta frt
        lda fr_hi,x
        sta frt+1
        lda #0
        sta chain
        ldx #4
@l:     lda estate,x
        cmp #ST_ACTIVE
        bne @n
        lda #1
        sta efright,x
        lda edir,x
        eor #2
        sta edir,x
@n:     dex
        bne @l
        lda #SFX_POWER
        jmp play_sfx

fr_lo:  .byte <400, <330, <270, <220, <170, <130, <100, <70
fr_hi:  .byte >400, >330, >270, >220, >170, >130, >100, >70

update_modes:
        lda frt
        ora frt+1
        beq @mode
        lda frt                 ; fright running: scatter/chase clock paused
        bne @a
        dec frt+1
@a:     dec frt
        lda frt
        ora frt+1
        bne @rts
        ldx #4
        lda #0
@cf:    sta efright,x
        dex
        bne @cf
        rts
@mode:  lda modephase
        cmp #7
        bcs @rts
        lda modet
        bne @b
        dec modet+1
@b:     dec modet
        lda modet
        ora modet+1
        bne @rts
        inc modephase
        lda mode
        eor #1
        sta mode
        ldx modephase
        lda mode_lo,x
        sta modet
        lda mode_hi,x
        sta modet+1
        ldx #4
@rv:    lda estate,x
        cmp #ST_ACTIVE
        bne @nr
        lda edir,x
        eor #2
        sta edir,x
@nr:    dex
        bne @rv
@rts:   rts

; X = enemy 1..4
move_enemy:
        lda estate,x
        bne @out
        dec etimer,x            ; waiting in the house
        bne @r
        lda #ST_LEAVE
        sta estate,x
@r:     rts
@out:   lda spd_en
        sta tmp0
        lda efright,x
        beq @nf
        lda spd_fr
        sta tmp0
@nf:    lda ey,x
        cmp #88                 ; tunnel row 11
        bne @nt
        lda ex,x
        cmp #48
        bcc @tun
        cmp #161
        bcc @nt
@tun:   lda spd_tun
        sta tmp0
@nt:    lda eacc,x
        clc
        adc tmp0
        sta eacc,x
        bcc @r
        lda estate,x
        cmp #ST_LEAVE
        bne @act
        lda ex,x                ; leaving: line up with the door, then go up
        cmp #HOUSE_X
        beq @lx
        bcc @lr
        dec ex,x
        rts
@lr:    inc ex,x
        rts
@lx:    lda ey,x
        cmp #EXIT_Y
        beq @free
        dec ey,x
        rts
@free:  lda #ST_ACTIVE
        sta estate,x
        lda #DIR_LEFT
        sta edir,x
        rts
@act:   lda ex,x
        ora ey,x
        and #7
        bne @step
        jsr decide
@step:  jmp move_px

; choose a direction for enemy X at a tile centre
decide:
        lda ex,x
        lsr
        lsr
        lsr
        sta cellx
        lda ey,x
        lsr
        lsr
        lsr
        sta celly
        lda efright,x
        beq @target
        jsr random              ; frightened: wander randomly
        and #3
        sta tmp2
        lda #4
        sta tmp3
@rl:    lda tmp2
        eor #2
        cmp edir,x
        beq @rn
        lda tmp2
        jsr neighbor_tile
        cmp #CH_DOOR
        bcs @rn
        lda tmp2
        sta edir,x
        rts
@rn:    lda tmp2
        clc
        adc #1
        and #3
        sta tmp2
        dec tmp3
        bne @rl
        lda edir,x
        eor #2
        sta edir,x
        rts
@target:
        jsr get_target
        lda #$ff
        sta bestd
        sta bestd+1
        lda edir,x
        eor #2
        sta bestdir
        lda #0
        sta tmp2
@dl:    lda tmp2
        eor #2
        cmp edir,x
        beq @dn
        lda tmp2
        jsr neighbor_tile
        cmp #CH_DOOR
        bcs @dn
        lda nx
        sec
        sbc tx
        jsr absclamp
        tay
        lda sqlo,y
        sta dist
        lda sqhi,y
        sta dist+1
        lda ny
        sec
        sbc ty
        jsr absclamp
        tay
        lda sqlo,y
        clc
        adc dist
        sta dist
        lda sqhi,y
        adc dist+1
        sta dist+1
        lda dist+1
        cmp bestd+1
        bcc @better
        bne @dn
        lda dist
        cmp bestd
        bcs @dn
@better:
        lda dist
        sta bestd
        lda dist+1
        sta bestd+1
        lda tmp2
        sta bestdir
@dn:    inc tmp2
        lda tmp2
        cmp #4
        bne @dl
        lda bestdir
        sta edir,x
        rts

; signed A -> |A| clamped to 63
absclamp:
        bpl @p
        eor #$ff
        clc
        adc #1
@p:     cmp #64
        bcc @ok
        lda #63
@ok:    rts

; target tile for enemy X -> tx, ty
get_target:
        lda ex
        lsr
        lsr
        lsr
        sta tmp0                ; pacman tile
        lda ey
        lsr
        lsr
        lsr
        sta tmp1
        lda mode
        bne @chase
        jmp @scatter
@chase: cpx #1
        bne @n1
@pac:   lda tmp0                ; officer: straight for you
        sta tx
        lda tmp1
        sta ty
        rts
@n1:    ldy edir
        cpx #2
        bne @n2
        lda dx4,y               ; cruiser: cut you off 4 tiles ahead
        clc
        adc tmp0
        sta tx
        lda dy4,y
        clc
        adc tmp1
        sta ty
        rts
@n2:    cpx #3
        bne @n3
        lda ex+1                ; chopper: flank, mirrored around the officer
        lsr
        lsr
        lsr
        sta tmp4
        lda ey+1
        lsr
        lsr
        lsr
        sta tmp5
        lda dx2,y
        clc
        adc tmp0
        asl
        sec
        sbc tmp4
        sta tx
        lda dy2,y
        clc
        adc tmp1
        asl
        sec
        sbc tmp5
        sta ty
        rts
@n3:    lda ex,x                ; tank: chases until close, then backs off
        lsr
        lsr
        lsr
        sec
        sbc tmp0
        jsr absclamp
        tay
        lda sqlo,y
        sta dist
        lda sqhi,y
        sta dist+1
        lda ey,x
        lsr
        lsr
        lsr
        sec
        sbc tmp1
        jsr absclamp
        tay
        lda sqlo,y
        clc
        adc dist
        sta dist
        lda sqhi,y
        adc dist+1
        bne @pac2
        lda dist
        cmp #65
        bcc @scatter
@pac2:  lda tmp0
        sta tx
        lda tmp1
        sta ty
        rts
@scatter:
        lda scat_x,x
        sta tx
        lda scat_y,x
        sta ty
        rts

scat_x: .byte 0, 25, 1, 26, 0
scat_y: .byte 0, -3, -3, 25, 25

check_collisions:
        ldx #1
@l:     lda estate,x
        cmp #ST_ACTIVE
        bne @n
        lda ex,x
        sec
        sbc ex
        bcs @p1
        eor #$ff
        adc #1
@p1:    cmp #6
        bcs @n
        lda ey,x
        sec
        sbc ey
        bcs @p2
        eor #$ff
        adc #1
@p2:    cmp #6
        bcs @n
        lda efright,x
        beq @kill
        jsr eat_enemy
        jmp @n
@kill:  lda #1
        sta died
        rts
@n:     inx
        cpx #5
        bne @l
        rts

eat_enemy:
        stx savex
        lda #0
        sta efright,x
        sta eacc,x
        lda #ST_HOUSE
        sta estate,x
        lda #60
        sta etimer,x
        lda #HOUSE_X
        sta ex,x
        lda #HOME_Y
        sta ey,x
        ldy chain
        lda chain_pts,y
        tay
        lda #0
        jsr add_score
        lda chain
        cmp #3
        bcs @c
        inc chain
@c:     lda #SFX_EAT
        jsr play_sfx
        jsr set_anim
        jsr update_sprites
        lda #15
        jsr wait_frames
        ldx savex
        rts

chain_pts:
        .byte $02, $04, $08, $16

; =====================================================================
;  sprites
; =====================================================================
pac_phase:
        .byte 0, 1, 2, 1
en_color:
        .byte 7, 14, 6, 3, 5

set_anim:
        lda pacmove
        beq @pa
        inc pacanim
@pa:    lda pacanim
        lsr
        lsr
        and #3
        tay
        lda pac_phase,y
        beq @closed
        sec
        sbc #1
        sta tmp0
        lda edir
        asl
        ora tmp0
        clc
        adc #SPR_PAC+1
        sta eptr
        jmp @pdone
@closed:
        lda #SPR_PAC
        sta eptr
@pdone: lda #7
        sta ecol
        lda frame
        lsr
        lsr
        lsr
        and #1
        sta tmp0
        ldx #1
@e:     lda efright,x
        beq @norm
        lda tmp0
        clc
        adc #SPR_FRIGHT
        sta eptr,x
        lda #6
        sta ecol,x
        lda frt+1
        bne @nx
        lda frt
        cmp #100
        bcs @nx
        lda frame
        and #8
        beq @nx
        lda #1
        sta ecol,x
        jmp @nx
@norm:  txa
        sec
        sbc #1
        asl
        ora tmp0
        clc
        adc #SPR_ENEMY
        sta eptr,x
        lda en_color,x
        sta ecol,x
@nx:    inx
        cpx #5
        bne @e
        rts

update_sprites:
        ldx #4
@l:     txa
        asl
        tay
        lda ex,x
        clc
        adc #20
        sta $d000,y
        lda ey,x
        clc
        adc #54
        sta $d001,y
        lda eptr,x
        sta SPRPTR,x
        lda ecol,x
        sta $d027,x
        dex
        bpl @l
        rts

; =====================================================================
;  sound
; =====================================================================
SFXV = $d40e                    ; voice 3 registers: all game sound effects

waka:
        lda sfxt                ; a sound effect has priority
        bne @r
        lda wakaf
        eor #1
        sta wakaf
        tay
        lda waka_hi,y
        sta SFXV+1
        lda #0
        sta SFXV
        sta SFXV+5
        lda #$a0
        sta SFXV+6
        lda #$10
        sta SFXV+4
        lda #$11
        sta SFXV+4
        lda #4
        sta wakat
@r:     rts

waka_hi:
        .byte $12, $18

; A = effect number (voice 3: frequency sweep)
play_sfx:
        tay
        lda #0
        sta wakat
        sta SFXV+5
        lda #$f0
        sta SFXV+6
        lda sfx_flo,y
        sta sfxlo
        sta SFXV
        lda sfx_fhi,y
        sta sfxhi
        sta SFXV+1
        lda sfx_dlo,y
        sta sfxdl
        lda sfx_dhi,y
        sta sfxdh
        lda sfx_len,y
        sta sfxt
        lda sfx_wav,y
        sta sfxwave
        and #$fe
        sta SFXV+4
        lda sfxwave
        sta SFXV+4
        rts

;           power  eat   death  extra  start
sfx_flo: .byte $00,  $00,  $00,  $00,  $00
sfx_fhi: .byte $08,  $10,  $28,  $30,  $0c
sfx_dlo: .byte $60,  $00,  $c0,  $00,  $18
sfx_dhi: .byte $00,  $02,  $ff,  $00,  $00
sfx_len: .byte 30,   20,   90,   30,   100
sfx_wav: .byte $11,  $21,  $21,  $11,  $41

sound_tick:
        lda gmusic              ; in-game background music on voices 1-2
        beq @nm
        jsr music_play
@nm:    lda wakat
        beq @s2
        dec wakat
        bne @s2
        lda #$10
        sta SFXV+4
@s2:    lda sfxt
        beq @r
        dec sfxt
        bne @sw
        lda sfxwave
        and #$fe
        sta SFXV+4
        rts
@sw:    lda sfxlo
        clc
        adc sfxdl
        sta sfxlo
        sta SFXV
        lda sfxhi
        adc sfxdh
        sta sfxhi
        sta SFXV+1
@r:     rts

; start the in-game GTA groove (voices 1-2)
game_music:
        lda #SONG_GAME
        jsr music_init
        lda #$08                ; pulse width for the effects voice
        sta SFXV+3
        lda #0
        sta sfxt
        sta wakat
        lda #1
        sta gmusic
        rts

music_stop:
        lda #0
        sta gmusic
        sta $d404
        sta $d40b
        sta $d417
        rts

; =====================================================================
;  generated data (maze, glyphs, tables)
; =====================================================================
        .include "gen_data.inc"

code_end:
        .assert code_end <= CHARSET, "code overlaps the charset at $3000"

        .org $3800
        .include "gen_sprites.inc"

; =====================================================================
;  $4000+: CPU-only code and data (outside the VIC bank)
; =====================================================================
        .org $4000
        .include "music.asm"
        .include "intro.asm"
        .include "intro_gta.asm"

high_end:
        .assert high_end <= $a000, "high code runs into BASIC ROM"
