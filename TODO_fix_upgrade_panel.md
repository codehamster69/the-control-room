# TODO: Fix Upgrade Panel Issues

## Tasks:

- [x] 1. Fix upgrade-service.ts - return actual calculated cost per hour instead of base 120
- [x] 2. Fix utils.ts - use Math.ceil for runtime calculation to show 1440 instead of 1439
- [x] 3. Fix hunt-bot-panel.tsx - add MAXED checks for bot speed and max runtime upgrades
- [x] 4. Add estimated items display for FREE and PAID hunt buttons
- [x] 5. Hide "Next" and "After" info when upgrade is maxed
- [x] 6. Test the changes

## Issues Fixed:

1. When maxed out bot speed, still seeing upgrade button instead of MAXED
2. When maxed out max runtime, still seeing upgrade button instead of MAXED
3. Max runtime showing 1439 min instead of 1440 min
4. Hunt not calculating cost based on cost/hr feature of huntbot
5. Added estimated items calculation based on runtime and items/hr
6. Hidden "Next" items/hr and "After" balance when upgrade is maxed
