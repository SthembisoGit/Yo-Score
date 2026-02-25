# UI_UX_IMPROVEMENT_GUIDELINES.md

> Use this file as the UI/UX refinement contract.
> Improvements must enhance clarity, usability, and accessibility
> WITHOUT breaking functionality, logic, security, or API contracts.

---

## Rules of UI/UX Enforcement 

1. Do NOT change business logic.
2. Do NOT change API contracts.
3. Do NOT modify validation or security rules.
4. Do NOT rename backend fields unless explicitly instructed.
5. UI improvements must be presentation-layer only unless approved.

For every UI change:
- ✅ Explain what usability issue is being improved
- ✅ Confirm no functional behavior changed
- ✅ Confirm no API contract changed
- ✅ Confirm accessibility not reduced
- ✅ Confirm no security regression introduced

If a proposed change impacts logic:
- Stop
- Explain impact
- Request confirmation

---

# 1. Core UX Principles

UI must be:

- Clear
- Predictable
- Minimal
- Accessible
- Consistent

Avoid:
- Visual clutter
- Hidden critical actions
- Over-animation
- Dark patterns
- Unclear feedback

---

# 2. Safe UI Improvements (Allowed Without Approval)

You MAY:

- Improve spacing and layout
- Improve typography hierarchy
- Improve color contrast
- Improve button consistency
- Improve form alignment
- Improve loading states
- Improve empty states
- Improve error message clarity (without changing meaning)
- Improve responsiveness
- Improve accessibility attributes (ARIA, labels)

You MAY NOT:

- Change field names
- Remove validation
- Change required fields
- Change form submission logic
- Change endpoint calls
- Change permission visibility rules

---

# 3. Layout & Visual Hierarchy

Rules:

- Use consistent spacing scale
- Primary actions must be visually distinct
- Destructive actions must be clearly marked
- Avoid more than 2–3 visual emphasis styles per screen
- Avoid competing CTAs

Hierarchy order:

1. Page Title
2. Section Headers
3. Primary Content
4. Secondary Actions
5. Metadata

---

# 4. Forms & Inputs

Rules:

- Always label inputs clearly
- Place validation errors near fields
- Use clear placeholder text (not as label replacement)
- Mark required fields visibly
- Disable submit during loading
- Prevent double submission

Error messages must:
- Be human-readable
- Not leak system details
- Match backend validation responses

---

# 5. Feedback & States

Every interactive action must have:

- Loading state
- Success feedback
- Error feedback

Avoid:
- Silent failures
- Unclear spinners
- Infinite loading

---

# 6. Accessibility Rules

Must meet baseline accessibility:

- Proper semantic HTML
- Buttons must be buttons (not divs)
- Inputs must have labels
- Images must have alt text
- Sufficient color contrast
- Keyboard navigable
- Focus states visible

Do not remove accessibility attributes for styling reasons.

---

# 7. Responsiveness

UI must:

- Work on mobile
- Avoid horizontal scrolling
- Use fluid layout
- Maintain readable font sizes
- Maintain accessible touch targets

---

# 8. Consistency Rules

- Reuse existing components when possible
- Follow existing design system
- Avoid introducing new patterns unnecessarily
- Keep iconography consistent
- Keep terminology consistent

---

# 9. Performance Safeguards

UI improvements must NOT:

- Introduce heavy libraries without justification
- Add large animations impacting performance
- Trigger unnecessary re-renders
- Increase bundle size significantly

If adding dependency:
- Justify size impact
- Confirm no performance regression

---

# 10. Change Control Rule for Contributors

When improving UI:

1. Identify the improvement goal.
2. Confirm no business logic altered.
3. Confirm no API change introduced.
4. Confirm accessibility maintained.
5. Confirm no security regression.

If improvement requires logic change:
- Explicitly state impact.
- Request approval.

---

# 11. Definition of UI Improvement Done

An improvement is complete when:

- Layout clearer
- Interaction smoother
- Accessibility intact or improved
- No functional regression
- No security regression
- No API contract change

---

## How to run this UI/UX improvement guide (operator procedure)

**Command template:**

“Using UI_UX_IMPROVEMENT_GUIDELINES.md,
improve the UI/UX of: {page/component/flow}.
Do NOT change backend logic or API contracts.
Preserve validation and security rules.
Explain improvements made.
Confirm no functional or security regression.”

---