/** adminAwdOps domain copy (English). */

export default {
	documentTitle: "AWD operations · FloatCTF",

	/** Action names passed to `call(...)` / `callVoid(...)` (only surface in fallback errors). */
	actionNames: {
		event: "Event details",
		status: "AWD event status",
		createAwd: "Enable AWD",
		saveConfig: "Save AWD configuration",
		precheckHistory: "Precheck history",
		eventNetwork: "Event network",
		allocateNetwork: "Allocate event network",
		autoAllocateNetwork: "Auto-allocate event network",
		reallocateNetwork: "Re-allocate event network",
		eventTeams: "Team list",
		banTeam: "Ban team",
		unbanTeam: "Unban team",
		addEventGamebox: "Attach GameBox",
		updateEventGamebox: "Update event GameBox",
		removeEventGamebox: "Remove attachment",
		resetGamebox: "Reset GameBox instance",
		scores: "AWD scoreboard",
		adjustScore: "Adjust score",
	},

	units: {
		seconds: "{{count}}s",
		hours: "{{count}}h",
	},

	validation: {
		integer: "Must be an integer",
		range: "Must be between {{min}} and {{max}}",
		cidr: "Must be a CIDR such as {{example}}",
		portInteger: "Must be an integer port number",
	},

	page: {
		title: "{{event}} · AWD operations",
		titleFallback: "AWD event operations",
		description:
			"End-to-end AWD operations: configuration, network, deployment, precheck, lifecycle, penalties and instances.",
		loadingLabel: "Loading event…",
		loadingEvent: "Loading event information…",
		loadFailed: "Failed to load event",
		backToList: "Back to events",
		backToConsole: "Event console",
		gameboxLibrary: "GameBox library",
	},

	breadcrumbs: {
		label: "Breadcrumbs",
		events: "Events",
		current: "AWD operations",
	},

	tabs: {
		config: "Configuration",
		precheck: "Precheck & tokens",
		scores: "Scores & penalties",
		teams: "Teams",
		gameboxes: "GameBox attachments",
		network: "Network",
		instances: "Instances",
	},

	lifecycle: {
		title: "Lifecycle actions",
		description:
			"Availability is decided by the backend state; disabled reasons appear in the button tooltip and the notes below.",
		loadingStatus: "Reading event status…",
		statusLoadFailed: "Failed to load the AWD event status",
		refresh: "Refresh status",
		submitSuccess: "{{action}} submitted",
		submitSuccessDescription: "The event status has been updated.",
		submitFailed: "{{action}} failed",
		unavailableSummary: "Unavailable actions ({{count}})",
		notEnabledTitle: "AWD is not enabled",
		notEnabledDescription:
			"Enable AWD on the Configuration tab and deploy, precheck and start actions will appear here.",
		networkError:
			"Failed to read the event network state (this is not “unallocated”): {{error}}. Deploy and precheck availability may be inaccurate.",
		eventMeta: "Format: {{family}} · Purpose: {{purpose}} · Window: {{start}} – {{end}}",
		fields: {
			status: "Event status",
			phase: "Current phase",
			roundCount: "Total rounds",
			roundDuration: "Round duration",
			initialScore: "Initial score",
			resetPolicy: "Free resets / extra penalty",
			plannedStart: "Planned start",
			verifiedAt: "Precheck passed",
			startedAt: "Started at",
			finalSettlement: "Final settlement",
			network: "Event network",
			configVersion: "Config version (optimistic lock)",
			notConfigured: "Not configured",
			manualStart: "Manual start",
			notVerified: "Not passed",
			notStarted: "Not started",
			settlementActive: "In progress (competition actions closed)",
			settlementInactive: "Not entered",
			networkAllocated: "Allocated",
			networkNotAllocated: "Not allocated",
			resetPolicyValue: "{{free}} resets / {{penalty}} pts",
		},
	},

	state: {
		notEnabled: "Not enabled",
		finalSettlement: "Final settlement",
		finalSettlementTitle:
			"The last round finished while judging is still settling: competition actions are closed",
		status: {
			draft: "Draft",
			configuring: "Configuring",
			deploying: "Deploying",
			deployed: "Deployed",
			prechecking: "Prechecking",
			verified: "Precheck passed",
			running: "Running",
			paused: "Paused",
			networkError: "Network error",
			startBlocked: "Start blocked",
			finished: "Finished",
			archived: "Archived",
			deployFailed: "Deploy failed",
			verificationFailed: "Precheck failed",
		},
		phase: {
			hardening: "Hardening",
			attack: "Attack",
			pause: "Paused",
		},
		gamebox: {
			pending: "Pending",
			creating: "Creating",
			running: "Running",
			ready: "Ready",
			resetting: "Resetting",
			missing: "Missing",
			orphan: "Orphan",
			conflict: "Conflict",
			startFailed: "Start failed",
			resetFailed: "Reset failed",
			stopped: "Stopped",
		},
	},

	actions: {
		deploy: "Deploy",
		precheck: "Precheck",
		start: "Start",
		pause: "Pause",
		resume: "Resume",
		finish: "Finish event",
		archive: "Archive",
		rotateTokens: "Rotate internal tokens",
	},

	confirm: {
		deploy: {
			title: "Deploy the AWD runtime?",
			description:
				"Provision the event runtime from the current configuration (idempotent, safe to re-run).",
			consequence1:
				"Create the event Docker network, FlagServer / JudgeServer containers and each team's GameBox instance containers",
			consequence2:
				"Assign subnets to teams and write their WireGuard peers, and lock the event network addresses (allocation cannot change after locking)",
			consequence3:
				"Apply the hardening-phase firewall policy; on failure the status becomes deploy_failed and you can retry after fixing",
			confirm: "Deploy",
		},
		precheck: {
			title: "Run an AWD precheck?",
			description:
				"Run structural and connectivity checks on configuration, containers, WireGuard, network, flags and the judging chain.",
			consequence1:
				"The event enters prechecking and player-side actions are unavailable during the check",
			consequence2:
				"On success the status becomes verified and the config revision is recorded; on failure it becomes verification_failed and the reason is stored",
			confirm: "Start precheck",
		},
		start: {
			title: "Start the AWD competition?",
			description:
				"Only allowed after a passed precheck (verified) with an unchanged config revision.",
			consequence1:
				"The status becomes running: round 1 starts immediately when hardening is 0, otherwise the hardening phase begins first",
			consequence2:
				"Write the initial score ledger for every participating team (idempotent; restarting does not double-count)",
			consequence3:
				"Switch to the attack-phase firewall policy; the AWD runtime configuration locks after the start",
			confirm: "Start",
		},
		pause: {
			title: "Pause the competition?",
			description: "Freeze the current phase and clear active connections for this event.",
			consequence1:
				"Save the remaining time of the hardening phase / current round and cancel scheduled tasks",
			consequence2:
				"Clear connections (conntrack) for the event subnet; player-side attack and defense actions stop",
			consequence3: "Resume continues from the remaining time and does not restart the round",
			confirm: "Pause",
		},
		resume: {
			title: "Resume the competition?",
			description: "Return from paused / network_error to running.",
			consequence1:
				"Restore the phase and remaining time from before the pause (enters the attack phase directly when hardening has no time left)",
			consequence2: "Restore the active round and firewall policy",
			confirm: "Resume",
		},
		finish: {
			title: "Finish the competition?",
			description:
				"Finishing only takes effect when final settlement is reached; otherwise the request succeeds but the event keeps running.",
			consequence1:
				"The status only becomes finished (scores finalized) after the last round completed and every judging task is terminal",
			consequence2:
				"Without settlement the event is not force-finished and running judging tasks are not interrupted",
			confirm: "Finish event",
		},
		archive: {
			title: "Archive the event? (irreversible)",
			description:
				"Archiving destroys the runtime and locks the event. If the event has not finished, it first attempts the finish flow.",
			consequence1:
				"Stop and delete every container of the event: GameBox instances, FlagServer and JudgeServer",
			consequence2:
				"Release host WireGuard peers, firewall policies and subnet allocations; the event network row is kept as history",
			consequence3:
				"The event status becomes archived (terminal); it can no longer be modified, deployed or restarted",
			consequence4:
				"Historical records and scores in the database are kept; archiving is irreversible",
			confirm: "Archive",
		},
		rotateTokens: {
			title: "Rotate internal tokens? (high risk)",
			description:
				"Increment key_version and re-encrypt / replace the internal tokens used by FlagServer / JudgeServer.",
			consequence1:
				"FlagServer / JudgeServer containers are recreated in place (same network / fixed IPs) to load the new tokens",
			consequence2: "Judging and flag settlement are briefly unavailable during the recreation",
			consequence3:
				"Challenge flags themselves are unchanged (the event key is unchanged); flags already submitted by players are unaffected",
			consequence4: "An internal token rotation audit record is written",
			confirm: "Rotate",
		},
	},

	gates: {
		networkNotAllocated:
			"The event network is not allocated yet (Network tab): this action needs the event network and infrastructure addresses",
		notEnabled: "AWD is not enabled: create the AWD event configuration first",
		notEnabledShort: "AWD is not enabled",
		deployBlocked:
			"The current status is “{{status}}”, so deploying is not allowed; only pre-runtime configuration states can deploy",
		deployBlock: {
			deploying: "A deployment is in progress (deploying); wait for it to finish",
			prechecking: "A precheck is in progress (prechecking); wait for it to finish",
			verified:
				"Precheck already passed: the runtime is ready and does not need another deploy; change the configuration to deploy again",
			startBlocked: "Start is blocked (start_blocked): pass a new precheck first",
			running: "The competition is running: it cannot be redeployed",
			paused: "The competition is paused: resume or finish it first",
			networkError: "Network error: recover the event first",
			finished: "The event has finished: it cannot be redeployed",
			archived: "The event is archived: it cannot be redeployed",
		},
		precheckBlocked:
			"The current status is “{{status}}”, so prechecking is not allowed; only pre-runtime configuration states can precheck",
		precheckBlock: {
			deploying: "A deployment is in progress: wait for it to finish",
			running: "The competition has started: only pre-runtime configuration states can precheck",
			paused: "The competition is paused: only pre-runtime configuration states can precheck",
			networkError: "Network error: recover the event first",
			finished: "The event has finished: it cannot be prechecked",
			archived: "The event is archived: it cannot be prechecked",
		},
		startBlocked:
			"Start is blocked (start_blocked): the configuration changed after verification, so a new precheck must pass before starting",
		startNotVerified:
			"The current status is “{{status}}”, so starting is not allowed; the backend requires a passed precheck (verified)",
		pauseSettlement:
			"Final settlement: the last round finished and competition actions are closed (it ends automatically after judging settles)",
		pauseNotRunning: "The current status is “{{status}}”; only a running competition can be paused",
		resumeNotPaused:
			"The current status is “{{status}}”; only paused or network-error events can be resumed",
		finishTerminal: "The current status is “{{status}}”, already terminal",
		finishNotRunning: "The current status is “{{status}}”; only a running competition can be finished",
		finishNoSettlement:
			"Final settlement has not been reached: the last round must be complete and every judging task terminal; calling now will not finish the event",
		archiveArchived: "Already archived (terminal); no need to archive again",
		archiveBlocked:
			"The current status is “{{status}}”, so archiving is not allowed; archiving requires a finished event and fails before final settlement",
		rotateTerminal: "The current status is “{{status}}”; internal tokens are no longer rotated",
		rotateNotEnabled: "AWD is not enabled: there are no internal tokens to rotate",
	},

	config: {
		emptyTitle: "AWD is not enabled",
		emptyDescription:
			"This event has no AWD configuration yet. After enabling it you can allocate the event network, deploy the runtime and precheck.",
		createAction: "Enable AWD",
		createBlocked: "This event is not an AWD event (currently “{{family}}”)",
		runtimeTitle: "AWD runtime configuration",
		runtimeDescription: "Ranges are validated by the backend; saving sends the optimistic-lock version.",
		editAction: "Edit configuration",
		editable: "Configuration editable",
		locked: "Configuration locked",
		updatedAt: "Optimistic-lock version updated_at: {{time}}",
		lockedReason: "The configuration is locked while the status is “{{status}}”",
		lockedNote:
			"The backend rejects configuration changes while the status is {{status}}: only draft / configuring / deployed / start blocked / deploy failed / precheck failed / precheck passed are editable.",
		form: {
			round_count: {
				label: "Total rounds",
				hint: "1 – 10000",
			},
			round_duration_secs: {
				label: "Round duration (seconds)",
				hint: "30 – 86400 seconds",
			},
			initial_score: {
				label: "Initial score",
				hint: "0 – 1e9",
			},
			free_reset_count: {
				label: "Free resets",
				hint: "0 – 100",
			},
			extra_reset_penalty: {
				label: "Extra reset penalty",
				hint: "0 – 1e9",
			},
			judge_max_concurrency: {
				label: "Max judge concurrency",
				hint: "1 – 1000",
			},
			judge_default_timeout_secs: {
				label: "Default judge timeout (seconds)",
				hint: "1 – 3600",
			},
			judge_retry_interval_secs: {
				label: "Judge retry interval (seconds)",
				hint: "1 – 3600",
			},
			archive_retention_hours: {
				label: "Archive retention (hours)",
				hint: "1 – 87600",
			},
			planned_start_at: {
				label: "Planned start time",
				hint: "Empty = manual start; clearing an existing schedule deletes the scheduled start task",
			},
		},
		detail: {
			totalRounds: "Total rounds",
			roundDuration: "Round duration",
			initialScore: "Initial score",
			freeResetCount: "Free resets",
			extraResetPenalty: "Extra reset penalty",
			judgeMaxConcurrency: "Max judge concurrency",
			judgeTimeout: "Default judge timeout",
			judgeRetry: "Judge retry interval",
			archiveRetention: "Archive retention",
			plannedStart: "Planned start",
			verifiedAt: "Precheck passed at",
			startedAt: "Started at",
			eventId: "Event ID",
		},
		values: {
			manualStart: "Manual start",
			notVerified: "Not passed",
			notStarted: "Not started",
		},
		create: {
			title: "Enable AWD",
			description:
				"Create the AWD configuration for this event. Empty fields use backend defaults; allocate the event network before deploying.",
			submit: "Enable",
			blockedHint: "This event is not an AWD event, so AWD cannot be enabled",
			blockedBody:
				"This event uses the “{{family}}” format; the backend only accepts events in the AWD format.",
			successTitle: "AWD enabled",
			successDescription:
				"Next, allocate the event network on the Network tab, then deploy.",
			failed: "Failed to enable AWD",
		},
		edit: {
			title: "Edit AWD configuration",
			description: "Optimistic-lock version: {{time}} (sent back with the request)",
			note: "Changing runtime parameters returns the event to configuring, increments the config revision and clears precheck results, so a new precheck is required.",
			success: "AWD configuration saved",
			failed: "Failed to save AWD configuration",
			conflictTitle: "The configuration was changed by someone else",
			conflictDescription:
				"Review the latest configuration and retry (the latest configuration has been reloaded).",
			noChangesTitle: "Nothing to save",
			noChangesDescription: "Change at least one field before submitting.",
		},
		validation: {
			plannedInvalid: "The time format cannot be parsed",
			plannedInPast: "The planned start time must be later than now",
		},
	},

	precheck: {
		trigger: {
			manual: "Manual",
			scheduled: "Scheduled",
		},
		title: "Precheck",
		description:
			"Check configuration / containers / WireGuard / network / flags / the judging chain; on success the status becomes precheck passed.",
		run: "Run precheck",
		runTitle: "Run one precheck",
		available: "Precheck available",
		unavailable: "Precheck unavailable",
		network: "Event network",
		networkReading: "Reading…",
		networkReadFailed: "Read failed",
		networkMissing: "Not allocated (precheck prerequisite)",
		networkAllocated: "Allocated",
		verifiedAt: "Precheck passed at",
		notVerified: "Not passed",
		historyTitle: "Precheck history",
		historyDescription:
			"Newest first by start time; select a row to inspect that run's failures and notes.",
		viewReport: "View report",
		refresh: "Refresh",
		emptyTitle: "No precheck runs yet",
		emptyDescription:
			"Once you run a precheck, each run's result and failure reasons appear here.",
		noFailures: "This precheck has no failures.",
		backendNoReason: "(the backend provided no reason)",
		notesSummary: "Notes ({{count}})",
		revision: "Network revision {{revision}}",
		columns: {
			result: "Result",
			trigger: "Trigger",
			revision: "Network revision",
			startedAt: "Started",
			completedAt: "Completed",
			errors: "Failures",
		},
		status: {
			pending: "Queued",
			running: "Running",
			passed: "Passed",
			failed: "Failed",
			error: "Errored",
		},
		successTitle: "Precheck passed",
		successDescription: "The event status is now precheck passed and the competition can start.",
		failedTitle: "Precheck failed",
		failedChecks: "Failed checks: {{checks}}",
		failedRecorded:
			"The backend recorded the failure reason; see the latest precheck report below.",
		failedNoDetail:
			"The backend returned no failure details; see the precheck history below.",
		errorTitle: "Precheck failed to run",
		rotateTitle: "Internal token rotation",
		rotateDescription:
			"Increment key_version and replace the internal tokens used by FlagServer / JudgeServer (both containers are recreated in place).",
		rotateAction: "Rotate internal tokens",
		rotateTitleAttr: "Rotate internal tokens",
		rotateNoteToken:
			"Rotation only affects platform-internal call tokens; challenge flags themselves do not change (the event key is unchanged).",
		rotateNoteDowntime:
			"Judging and flag settlement are briefly unavailable during the recreation; a failed attempt can be retried because the database update is atomic.",
		rotateSuccessTitle: "Internal tokens rotated",
		rotateSuccessDescription: "FlagServer / JudgeServer containers were recreated with the new tokens.",
		rotateFailed: "Failed to rotate internal tokens",
	},

	teams: {
		title: "Participating teams",
		description:
			"Banning cuts a team's competition network access (WireGuard / firewall / connection cleanup) and must be lifted manually.",
		emptyTitle: "No teams yet",
		emptyDescription:
			"AWD is a team competition: create teams and add members in the event console first.",
		members: "{{count}} members",
		banned: "Banned",
		normal: "Normal",
		ban: "Ban",
		unban: "Unban",
		columns: {
			team: "Team",
			status: "Status",
			captain: "Captain",
			members: "Members",
			createdAt: "Created",
			teamId: "Team ID",
		},
		banSheet: {
			title: "Ban team: {{team}}",
			description: "Bans are lifted manually and never expire automatically.",
			reasonLabel: "Ban reason",
			reasonHint: "Stored in the ban record for post-event audit",
			reasonPlaceholder: "e.g. attacking platform infrastructure",
			reasonRequired:
				"Provide a ban reason (it is stored in the ban record for post-event review)",
			submit: "Ban",
			successTitle: "Banned “{{team}}”",
			successDescription:
				"The team lost its competition network access and must be unbanned manually.",
			failed: "Failed to ban team",
		},
		confirmBan: {
			title: "Ban “{{team}}”?",
			description:
				"Banning immediately cuts the team's competition network access and does not expire.",
			consequence1:
				"Write a ban record (reason + operator) and sync the team's banned flag",
			consequence2:
				"Suspend the team's WireGuard peer on the host, rebuild the firewall banned set and clear connections for the team subnet",
			consequence3:
				"The team cannot submit flags, reach target machines (SSH) or reset instances until an administrator unbans it",
			confirm: "Ban",
		},
		confirmUnban: {
			title: "Unban “{{team}}”?",
			description: "Restore the team's competition network access.",
			consequence1: "Restore the team's WireGuard peer and firewall allowances on the host",
			consequence2:
				"After unbanning, the team can submit flags, reach target machines and reset instances again",
			consequence3: "Write a TeamUnbanned audit record",
			confirm: "Unban",
		},
		unbanSuccess: "Unbanned “{{team}}”",
		unbanFailed: "Failed to unban team",
		banActionAria: "Ban {{team}}",
	},

	gameboxes: {
		title: "Event GameBox attachments",
		description:
			"Choose which GameBoxes compete in this event; resources and judging parameters come from the GameBox recommendations and can be overridden here.",
		add: "Attach GameBox",
		emptyTitle: "No GameBoxes attached",
		emptyDescription:
			"Attach a successfully built (ready) GameBox from the GameBox library to this event.",
		columns: {
			gamebox: "GameBox",
			hostOffset: "Host number",
			enabled: "Enabled",
			visible: "Player visible",
			scores: "Scoring (attack / penalty / first blood)",
			resources: "Resources (CPU / memory / PIDs)",
			createdAt: "Attached",
		},
		enabled: "Enabled",
		disabled: "Disabled",
		visible: "Visible",
		hidden: "Hidden",
		partial: "Showing the first {{shown}} of {{total}} rows.",
		mobileMeta: "#{{offset}} · attack {{attack}} · penalty {{penalty}}",
		addSheet: {
			title: "Attach GameBox",
			description:
				"Only successfully built (ready) GameBoxes can be attached; resources and judging parameters default to the GameBox recommendations.",
			submit: "Attach",
			selectLabel: "GameBox",
			selectHint: "Already attached or not fully built GameBoxes are not listed",
			selectPlaceholder: "Select a GameBox…",
			selectLoading: "Loading GameBox library…",
			selectAria: "Select GameBox",
			selectOption: "{{name}} ({{safeName}})",
			noneAvailable:
				"No GameBox to attach: the library has no ready target machines (or all are already attached).",
			hostOffsetLabel: "Host number (host_offset)",
			hostOffsetHint: "Leave empty to auto-assign a free number within 2–254",
			hiddenLabel: "Hide from players",
			hiddenHint: "Hidden GameBoxes are not listed on the player side",
			attackLabel: "Attack score",
			penaltyLabel: "Downtime penalty",
			firstBonusLabel: "First-blood bonus",
			autoPlaceholder: "Auto",
			successTitle: "Attached “{{name}}”",
			successDescription:
				"Host number #{{offset}}; the config revision changed, so a new precheck is required.",
			failed: "Failed to attach GameBox",
		},
		editSheet: {
			title: "Event GameBox: {{name}}",
			description: "{{safeName}} · host number #{{offset}}",
			descriptionWithVersion: "{{safeName}} · v{{version}} · host number #{{offset}}",
			enabledLabel: "Enabled",
			enabledHint: "A disabled GameBox does not take part in the competition",
			hiddenLabel: "Hide from players",
			cpuLabel: "CPU (millis)",
			memoryLabel: "Memory (bytes)",
			pidsLabel: "Process limit",
			timeoutLabel: "Judge timeout override (seconds)",
			timeoutHint: "Empty = unchanged (the backend cannot clear an existing override)",
			retryLabel: "Judge retry interval override (seconds)",
			retryHint: "Empty = unchanged (the backend cannot clear an existing override)",
			attackLabel: "Attack score",
			penaltyLabel: "Downtime penalty",
			firstBonusLabel: "First-blood bonus",
			inheritPlaceholder: "Inherit event default",
			note: "Changing scoring / resource / judging parameters increments the config revision, so a new precheck must pass before the event can start.",
			success: "Updated “{{name}}”",
			failed: "Failed to update event GameBox",
			noChanges: "Nothing to save",
			cannotClear:
				"The backend cannot clear this override (null is ignored): enter a number",
		},
		removeConfirm: {
			title: "Remove the “{{name}}” attachment?",
			description: "After removal this GameBox no longer belongs to the event.",
			consequence1:
				"Delete the event–GameBox attachment record (config revision +1, a new precheck is required)",
			consequence2:
				"If the GameBox already has instances in this event, the backend rejects removal (handle the instances first)",
			consequence3: "Players will no longer see this target machine",
			confirm: "Remove",
		},
		removeSuccess: "Removed the “{{name}}” attachment",
		removeFailed: "Failed to remove attachment",
		removeTitle: "Remove attachment",
		editAria: "Edit {{name}}",
		removeAria: "Remove {{name}}",
	},

	network: {
		emptyTitle: "Event network not allocated",
		emptyDescription:
			"Allocate the event network before deploying: auto-allocation takes subnets from the platform pool, manual allocation lets you specify CIDRs.",
		autoAllocate: "Auto-allocate",
		manualAllocate: "Manual allocation",
		title: "Event network allocation",
		description:
			"The event's dedicated GameBox subnet, WireGuard subnet and infrastructure addresses.",
		reallocate: "Re-allocate",
		lockedPill: "Addresses locked",
		editablePill: "Addresses editable",
		modePill: "Allocation mode: {{mode}}",
		modeManual: "Manual",
		modeAutomatic: "Automatic",
		blockedLocked:
			"The event network was locked during deployment (locked): re-allocation is rejected by the backend",
		blockedStatus:
			"The current status is “{{status}}”: network addresses can only change in draft / configuring",
		reallocatable:
			"Re-allocate the GameBox / WireGuard subnets and the WireGuard port from the platform pool",
		fields: {
			gameboxCidr: "GameBox subnet",
			wireguardCidr: "WireGuard subnet",
			infrastructureSubnet: "Infrastructure subnet",
			flagserverIp: "FlagServer IP",
			judgeserverIp: "JudgeServer IP",
			dockerNetwork: "Docker network",
			wireguardInterface: "WireGuard interface",
			wireguardPort: "WireGuard port",
		},
		manual: {
			title: "Allocate the event network manually",
			description:
				"Specify the GameBox subnet and the WireGuard subnet (both are required); they must not overlap the platform pool or existing host subnets.",
			submit: "Allocate",
			gameboxLabel: "GameBox subnet (CIDR)",
			gameboxHint: "Event subnet where team target machines live",
			gameboxPlaceholder: "10.20.0.0/16",
			wireguardLabel: "WireGuard subnet (CIDR)",
			wireguardHint: "Player tunnel subnet",
			wireguardPlaceholder: "10.30.0.0/16",
			portLabel: "WireGuard listen port",
			portHint: "Leave empty and the platform picks a port from its range",
			autoPlaceholder: "Auto",
		},
		confirmAuto: {
			title: "Auto-allocate the event network?",
			description: "Allocate subnets from the platform network pool for this event.",
			consequence1:
				"Allocate the GameBox subnet, WireGuard subnet, infrastructure subnet and WireGuard listen port",
			consequence2: "Allocation creates no containers; containers are created during deploy",
			consequence3:
				"Addresses lock on deploy; repeated allocation is idempotent while unlocked",
			confirm: "Auto-allocate",
		},
		confirmReallocate: {
			title: "Re-allocate the event network? (high risk)",
			description: "This replaces the event's subnets and WireGuard port.",
			consequence1:
				"Release the current GameBox / WireGuard subnets and allocate new subnets and a new listen port from the platform pool",
			consequence2:
				"Deployed containers and the Docker network do not migrate automatically; a new deploy is required",
			consequence3:
				"Connections and WireGuard peers on the old subnets no longer belong to this event; a new precheck is required after re-allocation",
			consequence4:
				"Only available while the network is unlocked (draft / configuring); deploying locks the addresses",
			confirm: "Re-allocate",
		},
		toast: {
			autoSuccessTitle: "Event network auto-allocated",
			autoSuccessDescription: "Addresses lock on deploy; remember to run a precheck.",
			autoFailed: "Failed to auto-allocate the event network",
			manualSuccessTitle: "Event network allocated",
			manualSuccessDescription: "Addresses lock on deploy; remember to run a new precheck.",
			manualFailed: "Failed to allocate the event network",
			reallocateSuccessTitle: "Event network re-allocated",
			reallocateSuccessDescription:
				"Subnets and port changed; redeploy and run a new precheck.",
			reallocateFailed: "Failed to re-allocate the event network",
		},
	},

	instances: {
		title: "GameBox instances",
		description:
			"All target-machine instances of the event (normalized view); an admin reset recreates the container and returns it to its initial state.",
		refresh: "Refresh",
		emptyTitle: "No GameBox instances yet",
		emptyDescription:
			"After deploying the event and starting it, the platform creates GameBox instances for each team.",
		notBound: "Unbound",
		columns: {
			gamebox: "GameBox",
			status: "Runtime status",
			generation: "Generation",
			identifier: "Container",
			updatedAt: "Updated",
			instanceId: "Instance ID",
		},
		reset: "Reset",
		resetTitle: "Reset this instance (destroy and recreate the container, back to the initial state)",
		blocked: {
			notEnabled: "AWD is not enabled, so there is no instance to reset",
			notRunning:
				"The event status is “{{status}}”: only a running event allows instance resets",
			paused: "The event is paused: instance resets are not allowed while paused",
			settling:
				"Final settlement: the last round finished and instance resets are no longer allowed",
		},
		resetUnavailable: "Reset is unavailable: {{reason}}",
		confirm: {
			title: "Reset instance “{{name}}”?",
			description: "Resetting destroys and recreates the container of this instance.",
			consequence1:
				"The container is stopped, deleted and recreated from the current configuration; the instance returns to its initial state (flags are regenerated)",
			consequence2: "The instance generation (runtime_generation) is incremented",
			consequence3:
				"An admin reset does not consume the team's free reset count, but it is recorded in reset history and the audit log",
			consequence4: "The instance is briefly unavailable during the reset",
			confirm: "Reset",
		},
		toast: {
			successTitle: "Instance reset",
			failed: "Failed to reset instance",
		},
	},

	scores: {
		adjustTitle: "Score adjustment (audited)",
		adjustDescription:
			"delta is a signed integer: positive adds points and negative deducts them; every adjustment is written to the score ledger and audit log.",
		team: "Team",
		selectTeamAria: "Select team",
		selectTeamPlaceholder: "Select a team…",
		teamOption: "{{name}}",
		teamOptionBanned: "{{name}} (banned)",
		delta: "Score delta",
		deltaHint: "Integer, e.g. 100 or -50",
		deltaPlaceholder: "100",
		reason: "Reason",
		reasonHint: "Stored in the audit log and ledger note",
		reasonPlaceholder: "e.g. compensating a judging error",
		apply: "Apply adjustment",
		applyHint: "The scoreboard cache is invalidated and refetched immediately after applying.",
		applyDisabledTitle: "Select a team, enter a non-zero integer and a reason to submit",
		lockedTitle: "The event is terminal, so scores cannot be adjusted",
		lockedNotice:
			"The event is already terminal ({{status}}); the backend rejects further score adjustments.",
		scoreboardTitle: "Scoreboard",
		scoreboardDescription: "Ranked by total score (backend rank field).",
		emptyTitle: "No score data",
		emptyDescription: "Rankings appear once the competition starts and scoring events occur.",
		columns: {
			rank: "Rank",
			team: "Team",
			attack: "Attack score",
			defense: "Defense score",
			total: "Total",
			teamId: "Team ID",
		},
		banned: "Banned",
		mobileSubtitle: "Attack {{attack}} · Defense {{defense}}",
		toast: {
			adjustedTitle: "Score adjusted",
			adjustedDescription: "{{team}} {{delta}} pts; recorded in the audit log.",
			failed: "Failed to adjust score",
		},
		confirm: {
			title: "Adjust the score? ({{delta}})",
			description:
				"This appends a score ledger event and writes an audit log entry.",
			consequence1: "The total score of team “{{team}}” changes by {{delta}}",
			consequence2:
				"The adjustment is recorded as a ledger event and is never rolled back automatically (adjust again to undo)",
			consequence3:
				"The audit log records the operator, event, team and delta",
			confirm: "Apply adjustment",
		},
		loadTeams: "Loading team list…",
	},
};
