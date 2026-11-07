#!/bin/bash
# Optional udev rule to access the M-VAVE Tank G without sudo on Linux.
# MultiFX Editor talks to the pedal through ALSA rawmidi (amidi). This rule grants
# access to the pedal's ALSA MIDI device nodes (/dev/snd/midiC*D*); it is only
# needed if your user is not in the "audio" group.
# Run: sudo bash scripts/setup-udev.sh

# M-VAVE Tank G: Jieli Technology USB Composite Device
VENDOR_ID="4c4a"
PRODUCT_ID="c755"

RULE="SUBSYSTEM==\"sound\", ATTRS{idVendor}==\"$VENDOR_ID\", ATTRS{idProduct}==\"$PRODUCT_ID\", MODE=\"0666\""

echo "$RULE" | sudo tee /etc/udev/rules.d/99-multifx-editor.rules
sudo udevadm control --reload-rules
sudo udevadm trigger

echo "udev rule installed. Reconnect the pedal."
