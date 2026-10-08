; =====================================================================
;  Boot splash: the BBTG logo for about ten seconds, fading in from
;  black and back out again (each colour fades through darker shades)
; =====================================================================
SPLASH_ROW = 6                  ; logo rows 6-13, group name on 16, year on 18
SPLASH_POS = SCREEN + SPLASH_ROW*40
SP_STEP    = 20                 ; frames per fade step
SP_HOLD    = 250                ; frames at full brightness

sp_level = $b2                  ; 0 black .. 4 full colour
sp_phase = $b3                  ; 0 lead-in, 1 fade in, 2 hold, 3 fade out, 4 tail
sp_cnt   = $b4

logo_splash:
        jsr music_start
        lda #0
        sta $d015
        sta $d020
        sta $d021
        lda #$14                ; ROM charset: PETSCII blocks for the logo
        sta $d018
        lda #$08
        sta $d016
        jsr clear_screen
        lda #0
        sta sp_level
        sta sp_phase
        jsr splash_colors       ; everything black before the characters appear
        ldx #0
@cp:    lda splash_chars,x
        sta SPLASH_POS,x
        lda splash_chars+130,x
        sta SPLASH_POS+130,x
        lda splash_chars+260,x
        sta SPLASH_POS+260,x
        lda splash_chars+390,x
        sta SPLASH_POS+390,x
        inx
        cpx #130
        bne @cp
        lda #25
        sta sp_cnt

@frame: jsr wait_frame
        jsr music_play
        jsr read_input          ; fire skips straight to the cracktro
        lda joy
        and #$10
        bne @done
        dec sp_cnt
        bne @frame
        lda sp_phase
        beq @next               ; lead-in over
        cmp #1
        beq @in
        cmp #2
        beq @next               ; hold over
        cmp #3
        beq @out
        jmp @done               ; tail over
@in:    inc sp_level
        jsr splash_colors
        lda #SP_STEP
        sta sp_cnt
        lda sp_level
        cmp #4
        bne @frame
        beq @next
@out:   dec sp_level
        jsr splash_colors
        lda #SP_STEP
        sta sp_cnt
        lda sp_level
        bne @frame
@next:  inc sp_phase
        ldx sp_phase
        lda sp_len,x
        sta sp_cnt
        jmp @frame
@done:  jmp clear_screen

;          lead-in  fade in  hold     fade out  tail
sp_len: .byte 25,   SP_STEP, SP_HOLD, SP_STEP,  30

; colour RAM for all splash cells at the current fade level
splash_colors:
        lda #<splash_chain
        sta ptr0
        lda #>splash_chain
        sta ptr0+1
        lda #<[COLRAM+SPLASH_ROW*40]
        sta ptr1
        lda #>[COLRAM+SPLASH_ROW*40]
        sta ptr1+1
        ldx #>SPLASH_CELLS+1    ; whole pages, the last one partly
        ldy #0
@l:     lda (ptr0),y
        ora sp_level
        sty tmp0
        tay
        lda splash_fade,y
        ldy tmp0
        sta (ptr1),y
        iny
        bne @l
        inc ptr0+1
        inc ptr1+1
        dex
        bne @l
        rts
