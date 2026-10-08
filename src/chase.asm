; =====================================================================
;  The heist (part of the GTA intro): Pac-Man walks up to a parked car,
;  steals it, and the police give chase. Every step raises the wanted
;  level; at five stars the sirens start and the chopper joins in.
;  Sprites: 0 chopper, 1 Pac-Man on foot, 2 getaway car, 3 driver,
;  4-5 police cruisers.
; =====================================================================
CAR_PARK   = 200                ; sprite x of the parked car
CAR_Y      = 225                ; expanded car is 18 lines: wheels on the street
PAC_Y      = 227
DRIVER_DX  = 30                 ; driver's head in the front window
SPR_CAR    = $fb
SPR_COP_A  = $fc
SPR_COP_B  = $fd
SPR_DRIVER = $fe
CH_OFF     = 400                ; past the right border

ch_state = $a6                  ; 0 idle, 1 walking, 2 stealing, 3 chase
pac_x    = $a7
car_x    = $a8                  ; 16 bit positions; high byte $ff = not on the road
cop1_x   = $aa
cop2_x   = $ac
ch_timer = $ae
ch_star  = $af
ch_en    = $b0
ch_msb   = $b1

ev_chase:
        lda #1
        sta ch_state
        lda #0
        sta pac_x
        sta car_x+1
        lda #CAR_PARK
        sta car_x
        lda #$ff
        sta cop1_x+1
        sta cop2_x+1
        lda #SPR_CAR
        sta SPRPTR+2
        lda #SPR_DRIVER
        sta SPRPTR+3
        lda #7                  ; Pac-Man and the driver are yellow
        sta $d028
        sta $d02a
        lda #0                  ; cars: black
        sta $d029
        sta $d02b
        sta $d02c
        lda #PAC_Y
        sta $d003
        lda #CAR_Y
        sta $d005
        sta $d009
        sta $d00b
        lda #CAR_Y+1
        sta $d007
        rts

; once per frame: move everybody, then write positions and enable bits
chase_tick:
        lda #0
        sta ch_en
        lda gt_heli
        beq @c0
        lda #$01
        sta ch_en
@c0:    lda ch_state
        bne @c1
        jmp @show
@c1:    cmp #1
        bne @c2
        inc pac_x               ; walking up to the car (1.5 px per frame)
        lda frame
        and #1
        beq @w1
        inc pac_x
@w1:    lda frame
        lsr
        lsr
        and #1
        clc
        adc #SPR_PAC+7          ; chomping, facing right
        sta SPRPTR+1
        lda pac_x
        sta $d002
        lda ch_en
        ora #$06
        sta ch_en
        lda pac_x
        cmp #CAR_PARK+8         ; at the driver's door
        bcc @j1
        lda #2
        sta ch_state
        lda #40
        sta ch_timer
        jsr ev_star             ; grand theft auto: one star
@j1:    jmp @show
@c2:    cmp #2
        bne @c3
        lda frame               ; hot-wiring it: hazard lights flash
        and #4
        beq @al
        lda #7
@al:    sta $d029
        lda ch_en
        ora #$0c
        sta ch_en
        dec ch_timer
        bne @j2
        lda #0
        sta $d029
        lda #3
        sta ch_state
        lda #45
        sta ch_star
@j2:    jmp @show

@c3:    ldx #0                  ; the chase: everybody drives right
        jsr adv2
        ldx #2
        jsr adv2
        ldx #4
        jsr adv2
        lda cop1_x+1            ; first cruiser joins once the car is under way
        cmp #$ff
        bne @p2
        lda car_x+1
        bne @sp1
        lda car_x
        cmp #110
        bcc @p2
@sp1:   lda #0
        sta cop1_x
        sta cop1_x+1
@p2:    lda cop2_x+1            ; second cruiser follows the first
        cmp #$ff
        bne @lights
        lda cop1_x+1
        cmp #$ff
        beq @lights
        lda cop1_x+1
        bne @sp2
        lda cop1_x
        cmp #60
        bcc @lights
@sp2:   lda #0
        sta cop2_x
        sta cop2_x+1
@lights:
        lda frame               ; light bars flash red / white
        lsr
        lsr
        and #1
        clc
        adc #SPR_COP_A
        sta SPRPTR+4
        eor #1
        sta SPRPTR+5
        lda gt_stars            ; wanted level rises during the chase
        cmp #5
        bcs @nostar
        dec ch_star
        bne @nostar
        lda #45
        sta ch_star
        jsr ev_star
        lda gt_stars
        cmp #5
        bne @nostar
        jsr ev_wanted           ; five stars: sirens and the chopper
@nostar:
        lda cop2_x+1            ; everyone gone: the chase comes round again
        cmp #$ff
        beq @en
        ldx #4
        jsr on_road
        bcc @en
        lda #0
        sta car_x
        sta car_x+1
        lda #$ff
        sta cop1_x+1
        sta cop2_x+1
@en:    ldx #0
        jsr on_road
        bcs @e1
        lda ch_en
        ora #$0c
        sta ch_en
@e1:    ldx #2
        jsr on_road
        bcs @e2
        lda ch_en
        ora #$10
        sta ch_en
@e2:    ldx #4
        jsr on_road
        bcs @show
        lda ch_en
        ora #$20
        sta ch_en

@show:  lda heli_x+1            ; x positions and the x MSB register
        and #1
        sta ch_msb
        lda car_x
        sta $d004
        lda car_x+1
        and #1
        beq @m1
        lda ch_msb
        ora #$04
        sta ch_msb
@m1:    lda car_x
        clc
        adc #DRIVER_DX
        sta $d006
        lda car_x+1
        adc #0
        and #1
        beq @m2
        lda ch_msb
        ora #$08
        sta ch_msb
@m2:    lda cop1_x
        sta $d008
        lda cop1_x+1
        and #1
        beq @m3
        lda ch_msb
        ora #$10
        sta ch_msb
@m3:    lda cop2_x
        sta $d00a
        lda cop2_x+1
        and #1
        beq @m4
        lda ch_msb
        ora #$20
        sta ch_msb
@m4:    lda ch_msb
        sta $d010
        lda ch_en
        sta $d015
        rts

; X = 0/2/4 (car, cruiser 1, cruiser 2): move 2 px right until off screen
adv2:   lda car_x+1,x
        cmp #$ff
        beq @r
        cmp #>CH_OFF
        bcc @go
        lda car_x,x
        cmp #<CH_OFF
        bcs @r
@go:    lda car_x,x
        clc
        adc #2
        sta car_x,x
        bcc @r
        inc car_x+1,x
@r:     rts

; X = 0/2/4: carry clear if that vehicle is on screen
on_road:
        lda car_x+1,x
        cmp #$ff
        beq @no
        cmp #>CH_OFF
        bcc @yes
        lda car_x,x
        cmp #<CH_OFF
        bcs @no
@yes:   clc
        rts
@no:    sec
        rts
