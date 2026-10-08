; =====================================================================
;  GTA-style intro: "BBTG Vibathon Group presents", a Vice City sunset,
;  the skyline rising, the GRAND THEFT PAC-MAN logo slamming in, wanted
;  stars lighting up, police lights in the border and a chopper overhead
; =====================================================================
GT_FIRST  = 50
gt_t      = $96                 ; 2 bytes, frames since start
gt_ev     = $98                 ; next timeline event
gt_logo   = $99                 ; next logo row to reveal (0 = idle)
gt_sky    = $9a                 ; next skyline row to reveal (0 = idle)
gt_reveal = $9b                 ; sunset reveal line (0 = idle)
gt_fade   = $9c                 ; text fade: 0 idle, 1 in, 2 out
gt_fadec  = $9d
gt_police = $9e
gt_heli   = $9f                 ; chopper active
heli_x    = $a0                 ; 2 bytes
gt_flash  = $a2
gt_stars  = $a3
jmpv      = $a4                 ; 2 bytes

PRESENTS_ROW = 11
STAR_POS  = SCREEN + 12*40 + 15
FIRE_POS  = SCREEN + 13*40 + 5

intro_gta:
        lda #0
        sta $d015
        jsr clear_screen
        lda #<gta_glyphs        ; scene glyphs over chars $40-$ff
        sta ptr0
        lda #>gta_glyphs
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
        lda #$1c
        sta $d018
        lda #$18                ; multicolour text mode
        sta $d016
        lda #0                  ; outlines / buildings
        sta $d022
        lda #1                  ; logo fill
        sta $d023
        ldx #0
        txa
@cb:    sta rb_buf,x
        inx
        bne @cb
        lda #0
        sta gt_t
        sta gt_t+1
        sta gt_ev
        sta gt_logo
        sta gt_sky
        sta gt_reveal
        sta gt_fade
        sta gt_police
        sta gt_heli
        sta gt_flash
        sta gt_stars
        sta ch_state
        ; chopper + car chase sprites (see chase.asm): multicolour black
        ; (sprite colour), white ($d025) and red ($d026)
        lda #$35
        sta $d01c
        sta $d01d               ; chopper and cars twice as wide
        lda #$34
        sta $d017               ; cars twice as tall
        lda #0
        sta $d027
        sta $d015
        lda #1
        sta $d025
        lda #2
        sta $d026
        lda #52
        sta $d001

@frame: bit $d011
        bmi @frame
        lda #RB_LAST
        sta rb_end
        ldx #GT_FIRST
        jsr raster_bg
        lda #0
        sta $d021
        inc frame
        jsr music_play
        jsr gta_events
        jsr gta_effects
        inc gt_t
        bne @nt
        inc gt_t+1
@nt:    lda gt_t+1              ; fire skips (after a short moment)
        bne @canskip
        lda gt_t
        cmp #40
        bcc @noskip
@canskip:
        jsr read_input
        lda joy
        and #$10
        bne @exit
@noskip:
        lda gt_t+1              ; leave by itself after ~40 s
        cmp #>2000
        bcc @frame
        lda gt_t
        cmp #<2000
        bcc @frame
@exit:  lda #0
        sta $d015
        sta $d01d
        sta $d017
        sta $d010
        sta $d020
        sta $d021
        lda #$08
        sta $d016
        lda #$1e                ; restore sprite setup for the game
        sta $d01c
        lda #1
        sta $d025
        lda #10
        sta $d026
        jsr clear_screen
        jmp init_charset        ; restore the game glyphs

; background colour per raster line, set at the start of each line
raster_bg:
@w:     cpx $d012
        bne @w
        lda rb_buf,x
        sta $d021
        inx
        cpx rb_end
        bne @w
        rts

; ---- timeline: fire events whose time has come
gta_events:
        ldx gt_ev
        lda ev_hi,x
        cmp gt_t+1
        bne @r
        lda ev_lo,x
        cmp gt_t
        bne @r
        lda ev_jl,x
        sta jmpv
        lda ev_jh,x
        sta jmpv+1
        inc gt_ev
        jsr @call
        jmp gta_events          ; several events may share a frame
@r:     rts
@call:  jmp (jmpv)

EV_PRESENTS = 0
EV_FADEOUT  = 110
EV_CLEARTXT = 160
EV_SUNSET   = 165
EV_SKYLINE  = 270
EV_SLAM     = 300
EV_CHASE    = 320                ; the stars now come from the car chase

ev_lo:  .byte <EV_PRESENTS, <EV_FADEOUT, <EV_CLEARTXT, <EV_SUNSET, <EV_SKYLINE, <EV_SLAM, <EV_CHASE, $ff
ev_hi:  .byte >EV_PRESENTS, >EV_FADEOUT, >EV_CLEARTXT, >EV_SUNSET, >EV_SKYLINE, >EV_SLAM, >EV_CHASE, $ff
ev_jl:  .byte <ev_presents, <ev_fadeout, <ev_cleartxt, <ev_sunset, <ev_skyline, <ev_slam, <ev_chase
ev_jh:  .byte >ev_presents, >ev_fadeout, >ev_cleartxt, >ev_sunset, >ev_skyline, >ev_slam, >ev_chase

ev_presents:
        lda #<presents_text
        sta ptr0
        lda #>presents_text
        sta ptr0+1
        jsr print_list
        lda #0
        jsr set_text_color
        lda #1
        sta gt_fade
        lda #0
        sta gt_fadec
        rts

ev_fadeout:
        lda #2
        sta gt_fade
        lda #0
        sta gt_fadec
        rts

ev_cleartxt:
        lda #0
        sta gt_fade
        ldx #39
        lda #CH_SPACE
@c:     sta SCREEN+PRESENTS_ROW*40,x
        sta SCREEN+[PRESENTS_ROW+2]*40,x
        dex
        bpl @c
        rts

ev_sunset:
        lda #RB_LAST
        sta gt_reveal
        rts

ev_skyline:
        lda #22
        sta gt_sky
        rts

ev_slam:                        ; white flash, then the logo wipes in
        ldx #0
        lda #1
@f:     sta rb_buf,x
        inx
        bne @f
        lda #4
        sta gt_flash
        lda #1
        sta gt_logo
        ldx #8                  ; five dim stars
@s:     lda #GTA_STAR
        sta STAR_POS,x
        lda #11
        sta STAR_POS+COLRAM-SCREEN,x
        dex
        dex
        bpl @s
        rts

ev_star:                        ; light the next wanted star
        lda gt_stars
        asl
        tax
        lda #7
        sta STAR_POS+COLRAM-SCREEN,x
        inc gt_stars
        lda #1
        sta $d020
        lda #3
        sta gt_flash
        rts

ev_wanted:                      ; five stars: sirens on, chopper up
        lda #1
        sta gt_police
        sta gt_heli
        lda #0
        sta heli_x
        sta heli_x+1
        lda #<credit_text
        sta ptr0
        lda #>credit_text
        sta ptr0+1
        jmp print_list

; A = colour for the "presents" lines
set_text_color:
        ldx #39
@l:     sta COLRAM+PRESENTS_ROW*40,x
        sta COLRAM+[PRESENTS_ROW+2]*40,x
        dex
        bpl @l
        rts

; ---- continuous effects, once per frame
gta_effects:
        lda gt_fade             ; text fade in / out
        beq @nofade
        inc gt_fadec
        lda gt_fadec
        lsr
        lsr
        lsr
        cmp #5
        bcc @fi
        lda #4
@fi:    tax
        lda gt_fade
        cmp #2
        bne @fin
        txa
        eor #$ff
        clc
        adc #5
        tax
@fin:   lda fade_tab,x
        jsr set_text_color
@nofade:
        lda gt_reveal           ; sunset rises from the horizon
        beq @noreveal
        ldx gt_reveal
        lda gta_grad,x
        sta rb_buf,x
        dex
        lda gta_grad,x
        sta rb_buf,x
        dex
        lda gta_grad,x
        sta rb_buf,x
        dex
        cpx #GT_FIRST
        bcs @rv
        ldx #0
@rv:    stx gt_reveal
@noreveal:
        lda gt_sky              ; skyline rises, one row per frame
        beq @nosky
        jsr copy_scene_row
        dec gt_sky
        lda gt_sky
        cmp #14
        bne @nosky
        lda #0
        sta gt_sky
@nosky:
        lda gt_logo             ; logo wipes in, one row per frame
        beq @nologo
        jsr copy_scene_row
        inc gt_logo
        lda gt_logo
        cmp #11
        bne @nologo
        lda #0
        sta gt_logo
@nologo:
        lda gt_flash            ; end of a flash: restore sunset + border
        beq @noflash
        dec gt_flash
        bne @noflash
        lda #0
        sta $d020
        ldx #GT_FIRST
@rg:    lda gta_grad,x
        sta rb_buf,x
        inx
        cpx #RB_LAST+1
        bne @rg
@noflash:
        lda gt_police           ; red / blue police lights in the border
        beq @nopol
        lda frame
        and #8
        beq @blue
        lda #2
        bne @pol
@blue:  lda #6
@pol:   sta $d020
        lda frame               ; blinking prompt
        and #$20
        beq @hide
        lda #7
        bne @prompt
@hide:  lda #0
@prompt:
        ldx #28
@pc:    sta FIRE_POS+COLRAM-SCREEN,x
        dex
        bpl @pc
@nopol:
        lda gt_heli             ; police chopper crossing the sky
        beq @noheli
        inc heli_x
        bne @hx
        inc heli_x+1
@hx:    lda heli_x+1
        beq @hpos
        lda heli_x
        cmp #<[360-256]
        bcc @hpos
        lda #0
        sta heli_x
        sta heli_x+1
@hpos:  lda heli_x
        sta $d000
        lda frame
        lsr
        lsr
        and #1
        clc
        adc #SPR_ENEMY+4
        sta SPRPTR
@noheli:
        jmp chase_tick

; copy scene row A (chars + colours) to the screen
copy_scene_row:
        tax
        lda scrlo,x
        sta ptr1
        sta ptr0
        sta ptr3
        lda scrhi,x
        sta ptr1+1
        clc
        adc #>[COLRAM-SCREEN]
        sta ptr2+1
        lda ptr1
        sta ptr2
        lda ptr0                ; source = gta_chars / gta_cols + row*40
        clc
        adc #<[gta_chars-SCREEN]
        sta ptr0
        lda ptr1+1
        adc #>[gta_chars-SCREEN]
        sta ptr0+1
        lda ptr3
        clc
        adc #<[gta_cols-SCREEN]
        sta ptr3
        lda ptr1+1
        adc #>[gta_cols-SCREEN]
        sta ptr3+1
        ldy #39
@c:     lda (ptr0),y
        sta (ptr1),y
        lda (ptr3),y
        sta (ptr2),y
        dey
        bpl @c
        rts

fade_tab: .byte 0, 11, 12, 15, 1

presents_text:
        .byte 10,PRESENTS_ROW,0
        .scr "BBTG VIBATHON GROUP",0
        .byte 16,PRESENTS_ROW+2,0
        .scr "PRESENTS",0
        .byte $ff

credit_text:
        .byte 5,13,0
        .scr "PRESS FIRE TO HIT THE STREETS",0
        .byte 6,24,1
        .scr "(C) 2026 BBTG VIBATHON GROUP",0
        .byte $ff

        .include "chase.asm"
        .include "gen_gta.inc"
