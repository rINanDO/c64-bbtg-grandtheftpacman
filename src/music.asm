; =====================================================================
;  SID music player
;  - 3 voices, each with its own byte stream (notes, durations, instruments)
;  - wavetable per instrument: waveform + arpeggio/absolute pitch per frame
;    (drums, chord arpeggios, pitch scoops)
;  - pulse width modulation, delayed vibrato, hard restart
;  - resonant low-pass filter with per-note cutoff envelope + slow LFO sweep
;
;  stream bytes:  $00-$5f note   $60-$7f duration 1-32 steps
;                 $80-$8f instrument   $fd hold   $fe rest   $ff loop
; =====================================================================
MUS_SPEED = 7                   ; frames per step (~107 bpm in 16ths)
mptr      = $90                 ; zero page pointer

music_init:
        ldx #$18
        lda #0
@clr:   sta $d400,x
        dex
        bpl @clr
        ldx #2
@v:     lda mus_start_lo,x
        sta m_ptrlo,x
        lda mus_start_hi,x
        sta m_ptrhi,x
        lda #1
        sta m_dur,x
        lda #4
        sta m_len,x
        lda #0
        sta m_inst,x
        sta m_wt,x
        sta m_viblo,x
        sta m_vibhi,x
        sta m_vibdel,x
        lda #$fe
        sta m_gate,x
        dex
        bpl @v
        lda #1
        sta m_tick
        lda #0
        sta m_filt
        sta m_lfodir
        lda #$28
        sta m_cutbase
        sta m_cut
        lda #$1f                ; low-pass, volume 15
        sta $d418
        rts

music_play:
        dec m_tick
        bne @frames
        lda #MUS_SPEED
        sta m_tick
        ldx #0
        jsr voice_step
        ldx #1
        jsr voice_step
        ldx #2
        jsr voice_step
@frames:
        lda m_tick              ; hard restart: release gate one frame early
        cmp #1
        bne @nohr
        ldx #2
@hr:    lda m_dur,x
        cmp #1
        bne @nhr
        ldy m_inst,x
        lda ins_flags,y
        and #2
        beq @nhr
        lda #$fe
        sta m_gate,x
@nhr:   dex
        bpl @hr
@nohr:  ldx #0
        jsr voice_frame
        ldx #1
        jsr voice_frame
        ldx #2
        jsr voice_frame
        jmp filter_frame

; ---- advance the stream of voice X by one step
voice_step:
        dec m_dur,x
        beq @read
        rts
@read:  lda m_ptrlo,x
        sta mptr
        lda m_ptrhi,x
        sta mptr+1
        ldy #0
@next:  lda (mptr),y
        iny
        cmp #$60
        bcc @note
        cmp #$80
        bcc @dur
        cmp #$90
        bcc @inst
        cmp #$fd
        beq @done
        cmp #$fe
        beq @rest
        cmp #$ff
        beq @loop
        jmp @next
@dur:   sec
        sbc #$5f
        sta m_len,x
        jmp @next
@inst:  and #$0f
        sta m_inst,x
        jmp @next
@loop:  lda mus_loop_lo,x
        sta mptr
        lda mus_loop_hi,x
        sta mptr+1
        ldy #0
        jmp @next
@rest:  lda #$fe
        sta m_gate,x
        jmp @done
@note:  sta m_note,x
        jsr trigger
@done:  lda m_len,x
        sta m_dur,x
        tya
        clc
        adc mptr
        sta m_ptrlo,x
        lda mptr+1
        adc #0
        sta m_ptrhi,x
        rts

; ---- start a note on voice X with its instrument (preserves X, Y)
trigger:
        sty m_ysave
        ldy m_inst,x
        lda ins_ad,y
        sta m_tad
        lda ins_sr,y
        sta m_tsr
        lda ins_wt,y
        sta m_wt,x
        lda ins_pw,y
        sta m_pwhi,x
        lda #0
        sta m_pwlo,x
        sta m_pwdir,x
        sta m_viblo,x
        sta m_vibhi,x
        sta m_vibdir,x
        lda ins_vdel,y
        sta m_vibdel,x
        lda ins_vspd,y
        lsr
        adc #0
        sta m_vibcnt,x
        lda ins_flags,y         ; filter routing + cutoff envelope
        and #1
        beq @nof
        lda m_filt
        ora vbit,x
        sta m_filt
        lda m_cutbase
        clc
        adc #$50
        bcc @c
        lda #$ff
@c:     sta m_cut
        jmp @f
@nof:   lda vbit,x
        eor #$ff
        and m_filt
        sta m_filt
@f:     lda #$ff
        sta m_gate,x
        ldy voff,x
        lda #$08                ; test bit: reset oscillator, gate off
        sta $d404,y
        lda m_tad
        sta $d405,y
        lda m_tsr
        sta $d406,y
        ldy m_ysave
        rts

; ---- per-frame update of voice X: wavetable, vibrato, pulse, registers
voice_frame:
        ldy m_wt,x
@wt:    lda wt_wave,y
        cmp #$ff
        bne @ok
        lda wt_note,y
        tay
        jmp @wt
@ok:    and m_gate,x
        sta m_ctrl
        lda wt_note,y
        bmi @abs
        cmp #$40
        bcc @pos
        ora #$80
@pos:   clc
        adc m_note,x
        jmp @setn
@abs:   and #$7f
@setn:  cmp #96
        bcc @nok
        lda #95
@nok:   sta m_cn
        iny
        tya
        sta m_wt,x

        ldy m_inst,x            ; vibrato
        lda m_vibdel,x
        beq @vib
        dec m_vibdel,x
        jmp @novib
@vib:   lda ins_vdep,y
        beq @novib
        sta m_tdep
        lda m_vibdir,x
        bne @vdn
        lda m_viblo,x
        clc
        adc m_tdep
        sta m_viblo,x
        lda m_vibhi,x
        adc #0
        sta m_vibhi,x
        jmp @vcnt
@vdn:   lda m_viblo,x
        sec
        sbc m_tdep
        sta m_viblo,x
        lda m_vibhi,x
        sbc #0
        sta m_vibhi,x
@vcnt:  dec m_vibcnt,x
        bne @novib
        lda ins_vspd,y
        sta m_vibcnt,x
        lda m_vibdir,x
        eor #1
        sta m_vibdir,x
@novib:
        lda ins_pws,y           ; pulse width modulation (bounces $200-$e00)
        beq @nopw
        sta m_tdep
        lda m_pwdir,x
        bne @pdn
        lda m_pwlo,x
        clc
        adc m_tdep
        sta m_pwlo,x
        bcc @pc1
        inc m_pwhi,x
@pc1:   lda m_pwhi,x
        cmp #$0e
        bcc @nopw
        lda #1
        sta m_pwdir,x
        bne @nopw
@pdn:   lda m_pwlo,x
        sec
        sbc m_tdep
        sta m_pwlo,x
        bcs @pc2
        dec m_pwhi,x
@pc2:   lda m_pwhi,x
        cmp #$02
        bcs @nopw
        lda #0
        sta m_pwdir,x
@nopw:
        ldy m_cn
        lda freq_lo,y
        clc
        adc m_viblo,x
        sta m_tad
        lda freq_hi,y
        adc m_vibhi,x
        ldy voff,x
        sta $d401,y
        lda m_tad
        sta $d400,y
        lda m_pwlo,x
        sta $d402,y
        lda m_pwhi,x
        sta $d403,y
        lda m_ctrl
        sta $d404,y
        rts

; ---- filter: per-note cutoff envelope on top of a slow triangle LFO
filter_frame:
        inc m_fc
        lda m_fc
        and #3
        bne @env
        lda m_lfodir
        bne @ldn
        inc m_cutbase
        lda m_cutbase
        cmp #$70
        bcc @env
        inc m_lfodir
        bne @env
@ldn:   dec m_cutbase
        lda m_cutbase
        cmp #$18
        bcs @env
        dec m_lfodir
@env:   lda m_cut
        sec
        sbc #3
        bcc @floor
        cmp m_cutbase
        bcs @set
@floor: lda m_cutbase
@set:   sta m_cut
        sta $d416
        lda m_filt
        ora #$f0                ; resonance 15
        sta $d417
        rts

voff:   .byte 0, 7, 14
vbit:   .byte 1, 2, 4

; ---- player state
m_ptrlo:  .fill 3
m_ptrhi:  .fill 3
m_dur:    .fill 3
m_len:    .fill 3
m_inst:   .fill 3
m_note:   .fill 3
m_wt:     .fill 3
m_gate:   .fill 3
m_pwlo:   .fill 3
m_pwhi:   .fill 3
m_pwdir:  .fill 3
m_viblo:  .fill 3
m_vibhi:  .fill 3
m_vibcnt: .fill 3
m_vibdir: .fill 3
m_vibdel: .fill 3
m_tick:   .byte 0
m_ctrl:   .byte 0
m_cn:     .byte 0
m_tad:    .byte 0
m_tsr:    .byte 0
m_tdep:   .byte 0
m_ysave:  .byte 0
m_filt:   .byte 0
m_cut:    .byte 0
m_cutbase: .byte 0
m_lfodir: .byte 0
m_fc:     .byte 0

        .include "gen_music.inc"
