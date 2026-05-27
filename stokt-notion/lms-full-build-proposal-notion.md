## What This Is

A custom-built LMS means building every layer of the platform from the ground up. Authentication, content delivery, progress tracking, CE credit compliance, certificate generation, payment processing, admin tooling, and reporting. Nothing is inherited from a vendor. Every decision is yours. Every line of code is your responsibility to own, maintain, and evolve.

This document outlines the full scope of work, timeline, resource allocation, and long-term cost of that path.

---

## Scope Overview

<table header-row="true" fit-page-width="true">
	<tr>
		<td>Phase</td>
		<td>Description</td>
		<td>Timeline</td>
	</tr>
	<tr>
		<td>1</td>
		<td>Discovery and Architecture</td>
		<td>6-8 weeks</td>
	</tr>
	<tr>
		<td>2</td>
		<td>Core Platform Build</td>
		<td>16-20 weeks</td>
	</tr>
	<tr>
		<td>3</td>
		<td>Content Migration</td>
		<td>4-6 weeks</td>
	</tr>
	<tr>
		<td>4</td>
		<td>QA, Testing and Launch</td>
		<td>4-6 weeks</td>
	</tr>
	<tr>
		<td>—</td>
		<td>**Total Build Timeline**</td>
		<td>**30-40 weeks**</td>
	</tr>
</table>

---

## Phase 1: Discovery and Architecture

Before a single line of code is written, this phase produces the full technical blueprint of the platform. Every decision made here has downstream cost implications. Errors at this stage compound through every phase that follows.

**Deliverables:**
- User role map: learner, instructor, admin, super-admin
- Content schema: course, module, lesson, asset hierarchy
- CE credit tracking logic and compliance requirements
- Database architecture
- Infrastructure plan: hosting, CDN, storage, environments
- Auth strategy: SSO, role-based access control, membership tiers
- Approved tech stack and system architecture document

<table header-row="true" fit-page-width="true">
	<tr>
		<td>Role</td>
		<td>Hours</td>
		<td>Rate</td>
		<td>Cost</td>
	</tr>
	<tr>
		<td>Creative Director</td>
		<td>20</td>
		<td>$200</td>
		<td>$4,000</td>
	</tr>
	<tr>
		<td>Web Developer</td>
		<td>60</td>
		<td>$150</td>
		<td>$9,000</td>
	</tr>
	<tr>
		<td>Project Management</td>
		<td>40</td>
		<td>$130</td>
		<td>$5,200</td>
	</tr>
	<tr>
		<td>Strategist</td>
		<td>20</td>
		<td>$140</td>
		<td>$2,800</td>
	</tr>
	<tr>
		<td>**Phase 1 Total**</td>
		<td>**140 hrs**</td>
		<td></td>
		<td>**$21,000**</td>
	</tr>
</table>

---

## Phase 2: Core Platform Build

The full platform, built in parallel across backend and frontend tracks. This is where the majority of the investment lands.

**Backend systems:**
- Authentication and role-based access control
- Course and content management (CMS integration)
- Enrollment, progress tracking, and completion logic
- CE credit tracking engine and regulatory reporting
- Certificate generation with dynamic data injection
- Payment processing: subscriptions and one-time purchases
- Transactional email notifications
- Admin dashboard: user management, course publishing, reporting

**Frontend:**
- Course catalog and learner dashboard
- Video player with progress sync
- Quiz and assessment engine
- Certificate display and download
- Mobile-responsive interface
- Accessibility compliance (WCAG 2.1 AA)

**Infrastructure:**
- CI/CD pipeline
- Staging and production environments
- Error tracking and performance monitoring

<table header-row="true" fit-page-width="true">
	<tr>
		<td>Role</td>
		<td>Hours</td>
		<td>Rate</td>
		<td>Cost</td>
	</tr>
	<tr>
		<td>Creative Director</td>
		<td>40</td>
		<td>$200</td>
		<td>$8,000</td>
	</tr>
	<tr>
		<td>Web Designer</td>
		<td>160</td>
		<td>$150</td>
		<td>$24,000</td>
	</tr>
	<tr>
		<td>Web Developer</td>
		<td>400</td>
		<td>$150</td>
		<td>$60,000</td>
	</tr>
	<tr>
		<td>Project Management</td>
		<td>80</td>
		<td>$130</td>
		<td>$10,400</td>
	</tr>
	<tr>
		<td>Copywriter</td>
		<td>40</td>
		<td>$120</td>
		<td>$4,800</td>
	</tr>
	<tr>
		<td>**Phase 2 Total**</td>
		<td>**720 hrs**</td>
		<td></td>
		<td>**$107,200**</td>
	</tr>
</table>

---

## Phase 3: Content Migration

200+ video assets cannot simply be uploaded. Each asset requires auditing, format verification, re-encoding for CDN delivery (adaptive bitrate), metadata mapping, and QA after import. If accessibility compliance applies, each video also requires a caption file (SRT/VTT).

This phase is manual-intensive and scales linearly with content volume.

**What migration covers:**
- Full video asset audit: format, quality, encoding standards
- Re-encoding pipeline if source files don't meet CDN specs
- Batch upload to CDN (Bunny Stream or equivalent)
- Metadata mapping per asset: course assignment, module position, CE credit value, title, description, thumbnail
- Caption and transcript file preparation if required
- Quiz and assessment rebuild or import
- Existing learner progress data migration if applicable
- Full content QA pass post-import

> At 200+ videos, migration alone represents 80-120 hours of hands-on work under clean conditions. Source files in poor shape or inconsistent formats will push this higher.

<table header-row="true" fit-page-width="true">
	<tr>
		<td>Role</td>
		<td>Hours</td>
		<td>Rate</td>
		<td>Cost</td>
	</tr>
	<tr>
		<td>Web Developer</td>
		<td>80</td>
		<td>$150</td>
		<td>$12,000</td>
	</tr>
	<tr>
		<td>Project Management</td>
		<td>30</td>
		<td>$130</td>
		<td>$3,900</td>
	</tr>
	<tr>
		<td>**Phase 3 Total**</td>
		<td>**110 hrs**</td>
		<td></td>
		<td>**$15,900**</td>
	</tr>
</table>

---

## Phase 4: QA, Testing and Launch

No platform ships without a structured QA pass. This phase covers functional testing, load testing, compliance verification, security review, and a staged rollout.

**What this covers:**
- Cross-browser and cross-device QA
- Video delivery under concurrent user load
- Auth flow and access control security testing
- WCAG 2.1 AA compliance verification
- PIPEDA compliance review (data handling, privacy)
- User acceptance testing with client stakeholders
- Staged soft launch, feedback loop, hard launch

<table header-row="true" fit-page-width="true">
	<tr>
		<td>Role</td>
		<td>Hours</td>
		<td>Rate</td>
		<td>Cost</td>
	</tr>
	<tr>
		<td>Web Developer</td>
		<td>60</td>
		<td>$150</td>
		<td>$9,000</td>
	</tr>
	<tr>
		<td>Web Designer</td>
		<td>20</td>
		<td>$150</td>
		<td>$3,000</td>
	</tr>
	<tr>
		<td>Project Management</td>
		<td>30</td>
		<td>$130</td>
		<td>$3,900</td>
	</tr>
	<tr>
		<td>**Phase 4 Total**</td>
		<td>**110 hrs**</td>
		<td></td>
		<td>**$15,900**</td>
	</tr>
</table>

---

## Total Upfront Investment

<table header-row="true" fit-page-width="true">
	<tr>
		<td>Phase</td>
		<td>Cost</td>
	</tr>
	<tr>
		<td>Phase 1: Discovery and Architecture</td>
		<td>$21,000</td>
	</tr>
	<tr>
		<td>Phase 2: Core Platform Build</td>
		<td>$107,200</td>
	</tr>
	<tr>
		<td>Phase 3: Content Migration</td>
		<td>$15,900</td>
	</tr>
	<tr>
		<td>Phase 4: QA, Testing and Launch</td>
		<td>$15,900</td>
	</tr>
	<tr>
		<td>**Total Build Cost**</td>
		<td>**$160,000**</td>
	</tr>
</table>

> A 15% contingency reserve is recommended on all custom builds of this complexity. Unforeseen compliance requirements, content irregularities, or scope changes during development are not exceptions — they are expected. With contingency: **$184,000.**

---

## Annual Maintenance and Operations

A custom platform does not maintain itself. The following recurring costs begin the day the platform launches and continue indefinitely.

**What annual maintenance covers:**
- Dependency updates: framework versions, auth libraries, payment SDK, CMS
- Security patches and vulnerability response
- Bug fixes: browser regressions, device-specific issues, video playback edge cases
- CE credit compliance updates if regulatory requirements change
- Feature development: every new capability is a scoped dev engagement
- Hosting and CDN costs scaled to user volume and video bandwidth
- Performance monitoring and incident response

<table header-row="true" fit-page-width="true">
	<tr>
		<td>Item</td>
		<td>Monthly</td>
		<td>Annual</td>
	</tr>
	<tr>
		<td>Web Developer retainer (15 hrs/mo)</td>
		<td>$2,250</td>
		<td>$27,000</td>
	</tr>
	<tr>
		<td>Project Management (5 hrs/mo)</td>
		<td>$650</td>
		<td>$7,800</td>
	</tr>
	<tr>
		<td>Hosting and CDN infrastructure</td>
		<td>$400</td>
		<td>$4,800</td>
	</tr>
	<tr>
		<td>**Annual Total**</td>
		<td>**$3,300/mo**</td>
		<td>**$39,600/yr**</td>
	</tr>
</table>

---

## 3-Year Total Cost of Ownership

<table header-row="true" fit-page-width="true">
	<tr>
		<td>Year</td>
		<td>Cost</td>
	</tr>
	<tr>
		<td>Year 1 (build + first year maintenance)</td>
		<td>$223,600</td>
	</tr>
	<tr>
		<td>Year 2</td>
		<td>$39,600</td>
	</tr>
	<tr>
		<td>Year 3</td>
		<td>$39,600</td>
	</tr>
	<tr>
		<td>**3-Year Total**</td>
		<td>**$302,800**</td>
	</tr>
</table>

> This figure assumes stable scope. Any significant feature additions, regulatory changes to CE credit tracking, or platform migrations will add to this total.

---

## What You're Owning

A custom LMS is not a product purchase. It is a software asset that requires active stewardship. The organization taking on this build assumes full ownership of:

- **Security:** No vendor patches. Every vulnerability is your team's responsibility to identify and resolve.
- **Uptime:** No SLA from a platform provider. Infrastructure reliability depends entirely on your hosting configuration and monitoring setup.
- **Compliance:** CE credit regulations, accessibility standards, and privacy law changes require active tracking and implementation.
- **Feature parity:** The platform stays exactly as capable as the last dev engagement. Improvements cost money and time.
- **Institutional knowledge:** The codebase requires continuity. Developer turnover creates real risk.

These are not reasons to avoid a custom build categorically. They are the operational realities that need to be staffed, budgeted, and planned for before a single line of code is written.

---

*Prepared by Stōkt — [wearestokt.com](https://wearestokt.com)*
