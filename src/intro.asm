; =====================================================================
;  BBTG VIBATHON GROUP 2026 - cracktro
;  big colour-cycling logo, sine-moving raster bars in border and
;  background, copper bands behind the group name and a smooth scroller
; =====================================================================
RB_FIRST  = 44                  ; first raster line handled by the bar loop
RB_SPLIT1 = 219                 ; scroller row 21 = lines 219-226
RB_SPLIT2 = 228
RB_LAST   = 250
SCROLL_ROW = SCREEN + 21*40

rb_end   = $91
rb_phase = $92
rb_phase2 = $93
sc_x     = $94
sc_ptr   = $95                  ; 2 bytes

intro_bbtg:
        jsr music_start
        lda #0
        sta $d015
        sta $d020
        sta $d021
        lda #$14                ; screen $0400, ROM charset (PETSCII blocks)
        sta $d018
        jsr clear_screen
        ldx #0                  ; logo rows 1-8
@logo:  lda logo_chars,x
        sta SCREEN+40,x
        lda logo_cols,x
        sta COLRAM+40,x
        lda logo_chars+160,x
        sta SCREEN+40+160,x
        lda logo_cols+160,x
        sta COLRAM+40+160,x
        inx
        cpx #160
        bne @logo
        lda #<bbtg_text
        sta ptr0
        lda #>bbtg_text
        sta ptr0+1
        jsr print_list
        ldx #39
        lda #0
@sc:    sta COLRAM+21*40,x
        dex
        bpl @sc
        ldx #0                  ; raster buffer: all black
        txa
@cb:    sta rb_buf,x
        inx
        bne @cb
        ldx #4
@cy:    lda #RB_FIRST
        sta bar_prev,x
        dex
        bpl @cy
        lda #<scroll_text
        sta sc_ptr
        lda #>scroll_text
        sta sc_ptr+1
        lda #7
        sta sc_x
        lda #0
        sta rb_phase
        sta rb_phase2

@rel:   jsr wait_frame          ; ignore a fire button that is still held
        jsr music_play
        jsr read_input
        lda joy
        and #$10
        bne @rel

@frame: bit $d011               ; make sure we are in the upper half of the frame
        bmi @frame
        lda #RB_SPLIT1
        sta rb_end
        ldx #RB_FIRST
        jsr raster_lines
        lda sc_x                ; 38 columns + fine scroll for the scroller row
        sta $d016
        lda #RB_SPLIT2
        sta rb_end
        jsr raster_lines
        lda #$08
        sta $d016
        lda #RB_LAST
        sta rb_end
        jsr raster_lines
        lda #0
        sta $d020
        sta $d021

        ; ---- everything else runs in the lower border / vertical blank
        inc frame
        jsr music_play
        jsr update_bars
        lda rb_phase2
        and #15
        tax
        jsr logo_cycle
        jsr update_scroller
        jsr read_input
        lda joy
        and #$10
        bne @exit
        jmp @frame
@exit:  lda #0
        sta $d020
        sta $d021
        lda #$08
        sta $d016
        lda #$1c                ; back to the game charset
        sta $d018
        rts

; X = first raster line. Waits for each line and sets border + background
; colour right at its start (horizontal blank). ~26 cycles per line, so the
; loop stays in sync even on badlines.
raster_lines:
@w:     cpx $d012
        bne @w
        lda rb_buf,x
        sta $d021
        sta $d020
        inx
        cpx rb_end
        bne @w
        rts

update_bars:
        inc rb_phase
        inc rb_phase
        lda frame
        and #3
        bne @n
        inc rb_phase2
@n:     jsr bars_erase          ; generated, unrolled
        jsr bars_draw
        ; copper band behind the group name (rows 9-10)
        ldy #15
        lda rb_phase2
        and #15
        tax
@band:  lda band_pal,x
        sta rb_buf+123,y
        inx
        dey
        bpl @band
        ; static band behind the scroller
        ldy #9
@sb:    lda scroll_pal,y
        sta rb_buf+218,y
        dey
        bpl @sb
        rts

update_scroller:
        lda sc_x
        sec
        sbc #2
        bcs @ok
        ldx #0
@sh:    lda SCROLL_ROW+1,x
        sta SCROLL_ROW,x
        inx
        cpx #39
        bne @sh
        ldy #0
        lda (sc_ptr),y
        bne @ch
        lda #<scroll_text
        sta sc_ptr
        lda #>scroll_text
        sta sc_ptr+1
        lda #CH_SPACE
@ch:    sta SCROLL_ROW+39
        inc sc_ptr
        bne @n
        inc sc_ptr+1
@n:     lda sc_x
        clc
        adc #6
@ok:    and #7
        sta sc_x
        rts

band_pal:   .byte 10, 7, 1, 7, 10, 8, 15, 13, 1, 13, 3, 14, 1, 14, 15, 8
            .byte 10, 7, 1, 7, 10, 8, 15, 13, 1, 13, 3, 14, 1, 14, 15, 8
scroll_pal: .byte 6, 14, 14, 3, 1, 1, 3, 14, 14, 6
bar_prev:   .fill 5

bbtg_text:
        .byte 6,9,0
        .scr "V I B A T H O N   G R O U P",0
        .byte 13,10,0
        .scr "*  2 0 2 6  *",0
        .byte 12,12,15
        .scr "PROUDLY PRESENTS",0
        .byte 14,14,7
        .scr "P A C M A N",0
        .byte 10,15,10
        .scr "GRAND THEFT EDITION",0
        .byte 9,17,14
        .scr "CODE - GFX - SID MUSIC",0
        .byte 10,18,12
        .scr "BY THE BBTG VIBE CREW",0
        .byte 10,23,11
        .scr "PRESS FIRE OR SPACE",0
        .byte $ff

scroll_text:
        .scr "      WELCOME TO THE BBTG VIBATHON GROUP 2026!   "
        .scr "AI IS UNBELIEVABLE AND THE C64 ISN'T EXCLUDED!   "
        .scr "ALL THE DATA CENTERS ARE BUILDING A 20KB GAME IN JUST MINUTES!!   "
        .scr "THANKS TO ANTHONY, JEFFREY, JOCHEM, AND EVERYBODY ELSE HERE IN LEUSDEN!!!      "
        .scr "BBTG VIBATHON GROUP 2026 PROUDLY PRESENTS ...  PACMAN - GRAND THEFT EDITION ...  "
        .scr "THE STREETS ARE HOT AND THE COPS ARE ON YOUR TAIL ...  GRAB THE CASH AND BUST THEM BACK ...  "
        .scr "CODE, GRAPHICS AND SID MUSIC CRAFTED DURING THE VIBATHON ...  "
        .scr "GREETINGS TO ALL VIBE CODERS, SCENERS AND RETRO LOVERS OUT THERE ...  "
        .scr "PRESS FIRE OR SPACE TO HIT THE STREETS ...        ",0

        .include "gen_intro.inc"

; raster colour buffer, one byte per raster line (page aligned)
        .align 256
rb_buf:  .fill 256
