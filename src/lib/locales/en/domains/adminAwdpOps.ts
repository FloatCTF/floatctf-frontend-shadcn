/** adminAwdpOps domain copy (English). */

export default {
	page: {
		documentTitle: "AWDP operations · FloatCTF",
		documentTitleNamed: "{{name}} · AWDP operations · FloatCTF",
		title: "AWDP operations",
		titleNamed: "{{name}} · AWDP operations",
		subtitle:
			"End-to-end AWDP operations: configuration, phase transitions, GameBox attachment, instances and scoring. Phases are advanced by the backend; key data refreshes every 30 seconds.",
		breadcrumbEvents: "Events",
		breadcrumbCurrent: "AWDP operations",
		backToConsole: "Event console",
		backToEvents: "Back to events",
		loading: "Loading event…",
		loadingDescription: "Reading event details…",
		loadError: "Failed to load event",
		forbiddenDescription: "This administrator account cannot read the event (the backend returned 403).",
		notFoundTitle: "Event not found",
		notFoundDescription: "The event may have been deleted, or the ID is incorrect.",
		missingEventIdTitle: "Missing event ID",
		missingEventIdDescription: "The URL has no eventId. Open this page from the event management list.",
		meta: "{{family}} · {{mode}} mode",
	},
	tabs: {
		config: "Configuration",
		gameboxes: "GameBoxes",
		instances: "Instances",
		scores: "Scoreboard",
		data: "Data board",
		label: "AWDP operations sections",
	},
	phase: {
		sectionTitle: "Competition phase",
		sectionDescription:
			"The backend tick advances the phase over time. The buttons here only advance it early, and availability follows the current phase.",
		unknown: "Phase not loaded yet.",
		stepsLabel: "AWDP phase order",
		autoAdvanceNote:
			"When Break expires, the tick advances to the Fix phase; the last Fix round cutoff ends the competition.",
		resetNote:
			"“Break → Fix” resets every instance to pristine (runtime_generation +1, public ports unchanged). A failed reset stays in preparing_fix and can be retried with the same button.",
		disabledAction: "{{action}} is unavailable",
		configError: "Failed to load the AWDP configuration (the backend requires the event family to be AWDP)",
		label: {
			pending: "Pending",
			break: "Break",
			preparingFix: "Preparing Fix (transition)",
			fix: "Fix",
			ended: "Ended",
			unknown: "Unknown",
		},
		description: {
			pending: "Not started: waiting for a manual start or the scheduled start time.",
			break: "Break: players submit flags for points; when the countdown ends the competition enters the Fix phase.",
			preparingFix:
				"Transition: the platform is resetting every instance to pristine, then the Fix phase starts automatically.",
			fix: "Fix: official evaluation and scoring run at each round cutoff.",
			ended: "Ended: flags and patches are no longer accepted; queued evaluations still settle.",
			unknown: "Unknown phase: refresh the event configuration first.",
		},
		gates: {
			pending: {
				breakToFix: "Not started: start the competition before advancing to Break",
				finish: "Not started: start the competition before ending it",
			},
			break: {
				start: "Already started: start is idempotent and does not advance the phase",
				finish: "The backend only accepts Fix → Ended: advance to Fix before ending",
			},
			preparingFix: {
				start: "Already started",
				finish:
					"Transition: wait for (or retry) the instance reset, then enter the Fix phase before ending",
			},
			fix: {
				start: "Already started",
				breakToFix: "Already in Fix: the phase cannot return to Break",
			},
			ended: {
				start: "Ended: the backend refuses to restart a finished competition",
				breakToFix: "Ended",
				finish: "Ended (final state)",
			},
			unknown: "Unknown phase: refresh the event configuration first",
		},
		meta: {
			totalDuration: "Total duration (Break + Fix)",
			totalRounds: "Total rounds",
			currentRound: "Current round",
			breakScore: "Break score",
			fixRoundScore: "Fix score per round",
			configurationGeneration: "Configuration generation",
		},
	},
	actions: {
		start: "Start competition",
		breakToFix: "Break → Fix",
		finish: "End competition",
		submitted: "{{action}} submitted",
		submittedDescription: "The phase was updated and page data reloaded.",
		failed: "{{action}} failed",
	},
	confirm: {
		start: {
			title: "Start the AWDP competition?",
			description: "Creates this competition run and immediately enters the Break phase.",
			consequence1:
				"Creates the run from the current configuration snapshot (Break duration, Fix duration and scores)",
			consequence2:
				"Enters Break immediately and starts the countdown; when Break expires the run prepares Fix and then enters Fix",
			consequence3:
				"Starts instances for every participant on all attached, visible GameBoxes (idempotent)",
			consequence4:
				"Configuration is locked once started; a finished event cannot be restarted",
			confirmText: "Start competition",
		},
		breakToFix: {
			title: "Advance to the Fix phase? (all instances are reset)",
			description:
				"Break → Preparing Fix → Fix. This resets every instance to its initial state.",
			consequence1:
				"Resets every started instance to pristine: runtime_generation +1, public ports unchanged",
			consequence2:
				"The event stays in the preparing_fix transition until every reset succeeds, then enters Fix",
			consequence3:
				"If any reset fails the event stays in preparing_fix and can be retried with the same button (resets are idempotent)",
			consequence4: "Once in Fix, official evaluation and scoring run at each round cutoff",
			confirmText: "Enter Fix phase",
		},
		finish: {
			title: "End the AWDP competition?",
			description: "Fix → Ended: the competition ends immediately.",
			consequence1: "The event enters ended: players can no longer submit flags or patches",
			consequence2: "Official evaluations already queued keep settling and scoring",
			consequence3:
				"Stops this run's instances and tears down the event network on a best-effort basis; the submitted end state is not rolled back",
			confirmText: "End competition",
		},
	},
	config: {
		sectionTitle: "AWDP configuration and runtime state",
		loadError: "Failed to load the AWDP configuration (the backend requires the event family to be AWDP)",
		locked: "Configuration locked (an active run exists)",
		editable: "Configuration editable",
		generation: "Configuration generation {{count}}",
		updatedAt: "Optimistic-lock version updated_at: {{time}}",
		edit: "Edit configuration",
		editLockedTitle: "Competition in progress ({{phase}}): the backend locks the configuration",
		editHint: "Edit configuration (optimistic lock)",
		fields: {
			breakDuration: "Break duration",
			fixDuration: "Fix duration",
			roundInterval: "Round interval",
			totalRounds: "Total rounds",
			breakScore: "Break score",
			fixRoundScore: "Fix score per round",
			currentRound: "Current round",
			startedAt: "Started at",
			breakEndsAt: "Break ends",
			fixStartedAt: "Fix started",
			fixEndsAt: "Fix ends",
			finishedAt: "Finished at",
			nextActionAt: "Next action at",
			eventId: "Event ID",
		},
		values: {
			notStarted: "Not started",
			notFinished: "Not finished",
		},
		sheet: {
			title: "Edit AWDP configuration",
			description: "Optimistic-lock version: {{time}} (sent back on submit)",
			breakDuration: "Break duration (derived by the backend)",
			breakDurationHint: "= event total duration − Fix duration; not directly configurable",
			fixDuration: "Fix duration (seconds)",
			fixDurationHint: "Rounded down to a multiple of the round interval on save",
			roundInterval: "Round interval (seconds)",
			roundIntervalHint: "Cutoff interval for each round",
			breakScore: "Break score",
			breakScoreHint: "Full Break score when every defense succeeds",
			breakScoreDerived:
				"Derived value is currently {{value}} (fix_round_score × rounds × 0.6)",
			fixRoundScore: "Fix score per round",
			fixRoundScoreHint: "Points earned per Fix round",
			fixRoundScoreRounds: "Fix rounds: {{count}}",
			note: "Saving recalculates the event end time (start time + Break + Fix) and increments the configuration generation. New settings only affect future competitions and never change scores already earned.",
		},
		toasts: {
			saved: "AWDP configuration saved",
			savedDescription: "The event end time was recalculated as start time + Break + Fix.",
			conflict: "Configuration changed by someone else",
			conflictDescription:
				"Review the latest configuration and try again (the newest configuration was reloaded automatically).",
			saveFailed: "Failed to save the AWDP configuration",
			noChanges: "Nothing to save",
		},
		errors: {
			durationPositive: "Fix duration must be a positive integer number of seconds",
			intervalPositive: "Round interval must be a positive integer number of seconds",
			notDivisible:
				"Fix duration must be divisible by the round interval (currently {{duration}} / {{interval}})",
			scoreInteger: "Must be a non-negative integer",
			scoreMax: "Must not exceed 1e9",
		},
	},
	gameboxes: {
		loadError: "Failed to load the event GameBox list",
		sectionTitle: "Event GameBoxes",
		sectionDescription:
			"AWDP requires GameBoxes with the full [awdp] capability. Attaching during a live competition starts instances for participants automatically.",
		attach: "Attach GameBox",
		attachTitle: "Attach GameBox",
		attachDescription:
			"Only built (ready) GameBoxes that are not attached yet are listed; the backend validates the [awdp] capability.",
		fieldGamebox: "GameBox",
		fieldGameboxAria: "Select GameBox",
		selectPlaceholder: "Select a GameBox…",
		loadingLibrary: "Loading GameBox library…",
		noReady:
			"No GameBoxes available to attach: the library has no ready targets (or all are already attached).",
		option: "{{name}} ({{safeName}})",
		hiddenLabel: "Hide from players",
		hiddenHint: "Hidden GameBoxes do not start instances for participants",
		attachToast: "Attached “{{name}}”",
		attachFailed: "Failed to attach the GameBox",
		attachConfirm: {
			title: "Attach “{{name}}”?",
			description: "Once attached, the GameBox appears in this event (player view and instance view).",
			consequence1: "Copies the GameBox recommended resources (CPU / memory / PIDs) to the event attachment",
			consequence2:
				"If the competition is live (Break / Fix) and the GameBox is visible, instances start for every participant",
			consequence3:
				"If marked hidden, no instances start and players cannot see it",
			consequence4:
				"The backend requires the GameBox to be built and fully [awdp]-capable, otherwise it rejects the request with a reason",
			confirmText: "Attach",
		},
		detachAria: "Detach {{name}}",
		detachTitle: "Detach",
		detachToast: "Detached “{{name}}”",
		detachFailed: "Failed to detach the GameBox",
		detachConfirm: {
			title: "Detach “{{name}}”? (cascades data deletion)",
			description:
				"Deleting the attachment cascades to every row whose event_gamebox_id references it (ON DELETE CASCADE).",
			consequence1:
				"Instance records for this GameBox in the event are deleted (containers are not stopped automatically)",
			consequence2:
				"Break records and the scoring ledger (score_events) for this GameBox are deleted, which changes scoreboard history",
			consequence3:
				"Players no longer see the GameBox; re-attaching does not restore the deleted records",
			confirmText: "Detach",
		},
		emptyTitle: "No GameBoxes attached",
		emptyDescription:
			"GameBoxes are the challenges of an AWDP event: participants see and launch them only after attachment.",
		columns: {
			gamebox: "GameBox",
			capability: "[awdp] capability",
			buildStatus: "Build status",
			enabled: "Enabled",
			visible: "Player visibility",
			resources: "Resources (CPU / memory / PIDs)",
			sourceDir: "Source directory",
		},
		buildStatus: {
			ready: "Built",
			building: "Building",
			failed: "Build failed",
		},
		capabilityComplete: "Complete",
		capabilityMissing: "Missing",
		capabilityCompleteShort: "[awdp] complete",
		capabilityMissingShort: "[awdp] missing",
		enabledTrue: "Enabled",
		enabledFalse: "Disabled",
		visibleTrue: "Visible",
		visibleFalse: "Hidden",
		mobileMeta: "{{safeName}} · {{category}} · {{status}}",
		footnote:
			"Attachment only controls which challenges are visible; instances are launched for participants (attaching during a live competition starts them automatically).",
	},
	instances: {
		loadError: "Failed to load event instances",
		sectionTitle: "Event instances",
		sectionDescription:
			"Every participant's AWDP instances in this event, including runtime state and public endpoints.",
		columns: {
			gamebox: "GameBox",
			runtimeState: "Runtime state",
			generation: "Generation",
			resetCount: "Resets",
			endpoints: "Endpoints",
			containerName: "Container",
			instanceId: "Instance ID",
		},
		subjectTeam: "Team subject",
		subjectUser: "Individual subject",
		subjectUnbound: "Unbound subject",
		runtime: {
			running: "Running",
			resetting: "Resetting",
			pending: "Starting",
			stopped: "Stopped",
			exited: "Exited",
		},
		endpoint: "{{protocol}}://{{host}}:{{port}} → container {{containerPort}}",
		emptyTitle: "No instances yet",
		emptyDescription:
			"The platform starts instances for participants on attached GameBoxes once the competition begins.",
		mobileMeta: "{{subject}} · generation {{generation}} · resets {{resetCount}}",
		refresh: "Refresh instances",
	},
	scores: {
		loadError: "Failed to load the scoreboard",
		sectionTitle: "Scoreboard",
		sectionDescription:
			"Refreshes every 30 seconds; after a phase change or a disconnect, use Refresh to fetch the latest values immediately.",
		columns: {
			rank: "Rank",
			subject: "Subject",
			breakScore: "Break",
			fixScore: "Fix",
			totalScore: "Total",
			subjectId: "Subject ID",
		},
		emptyTitle: "No scores yet",
		emptyDescription:
			"Rankings appear here once the competition starts and scoring events are recorded.",
		mobileRankSubject: "#{{rank}} {{name}}",
		mobileScores: "Break {{breakScore}} · Fix {{fixScore}}",
	},
	data: {
		loadError: "Failed to load the event data board",
		stats: {
			users: "Participants",
			teams: "Teams",
			gameboxes: "GameBoxes",
			recent: "Recent activity",
		},
		statsHint: {
			gameboxes: "Attached GameBoxes",
			recent: "Latest scoring events returned by the backend",
		},
		top: {
			title: "Top 10 scores",
			description: "Same source as the scoreboard, ordered by total score.",
			emptyTitle: "No scores yet",
			emptyDescription:
				"Rankings appear here once the competition starts and scoring events are recorded.",
		},
		gameboxStats: {
			title: "Per-GameBox attack and defense",
			description: "Break count and successful Fix count.",
			emptyTitle: "No GameBox statistics yet",
			emptyDescription: "Statistics appear after GameBoxes are attached and the competition starts.",
			breakCount: "Breaks",
			fixCount: "Fixes",
			mobileCounts: "Breaks {{breakCount}} · Fixes {{fixCount}}",
		},
		trend: {
			title: "Score trend",
			description: "Backend-aggregated score time series.",
		},
		activity: {
			title: "Recent scoring activity",
			description: "Latest break and fix events.",
			emptyTitle: "No scoring activity yet",
			emptyDescription: "Break and fix events are summarised here as they happen.",
			line: "{{subject}} {{action}} {{gamebox}}",
			actionBreak: "broke",
			actionFix: "fixed",
			columns: {
				activity: "Activity",
				detail: "Category / time",
				delta: "Delta",
			},
		},
	},
	calls: {
		event: "Event details",
		config: "AWDP configuration",
		eventGameboxes: "Event GameBox list",
		instances: "Instance list",
		scores: "AWDP scoreboard",
		data: "Event data board",
		updateConfig: "Save AWDP configuration",
		attach: "Attach GameBox",
		detach: "Detach GameBox",
	},
};
