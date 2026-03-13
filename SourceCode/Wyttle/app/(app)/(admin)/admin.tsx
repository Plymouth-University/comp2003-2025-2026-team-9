import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable, ActivityIndicator, Alert, Image, Dimensions, TextInput, Animated } from 'react-native';
import { router } from 'expo-router';
import { supabase, Profile } from '../../../src/lib/supabase';
import { Logo } from '@/components/Logo';
import { ThemedText } from '@/components/themed-text';
import { Toast } from '@/components/ui/Toast';
import { BackButton } from '@/components/ui/BackButton';
import MentorBottomNav from '../../../src/components/nav/MentorBottomNav';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

const GRID_CARD_WIDTH = 100;
const GRID_GAP = 15;
const GRID_H_PADDING = 12;
const GRID_AVATAR_SIZE = 56;
const screenWidth = Dimensions.get('window').width;

type Tab = 'analytics' | 'pending' | 'all';
type UserRoleFilter = 'all' | 'admin' | 'mentor' | 'member';
type ApprovalFilter = 'all' | 'approved' | 'pending' | 'rejected';
type ApplicationRow = {
	status: string | null;
	user_type: string | null;
};
type MessageRow = {
	thread_id: number | null;
	inserted_at: string | null;
};
type MatchRow = {
	created_at: string | null;
};
type SessionRequestRow = {
	status: string | null;
	proposed_at: string | null;
	scheduled_start: string | null;
	tokens_cost: number | null;
};
type AnalyticsMetric = {
	label: string;
	value: number;
	color: string;
};

const ROLE_ORDER = ['admin', 'mentor', 'member'] as const;
const ROLE_CHART_COLORS: Record<string, string> = {
	admin: '#d95f5f',
	mentor: '#968c6c',
	member: '#4f6b9a',
};
const APPROVAL_CHART_COLORS: Record<string, string> = {
	approved: '#4d9b6e',
	pending: '#c3a76d',
	rejected: '#cf5f5f',
};
const APPLICATION_TYPE_COLORS: Record<string, string> = {
	mentor: '#7d89d6',
	member: '#4f6b9a',
};
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Profile>);
const USER_ROLE_FILTERS: { label: string; value: UserRoleFilter }[] = [
	{ label: 'All roles', value: 'all' },
	{ label: 'Admins', value: 'admin' },
	{ label: 'Mentors', value: 'mentor' },
	{ label: 'Members', value: 'member' },
];
const USER_APPROVAL_FILTERS: { label: string; value: ApprovalFilter }[] = [
	{ label: 'All statuses', value: 'all' },
	{ label: 'Approved', value: 'approved' },
	{ label: 'Pending', value: 'pending' },
	{ label: 'Rejected', value: 'rejected' },
];

export default function AdminPanel() {
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [applications, setApplications] = useState<ApplicationRow[]>([]);
	const [messages, setMessages] = useState<MessageRow[]>([]);
	const [peerMatches, setPeerMatches] = useState<MatchRow[]>([]);
	const [sessionRequests, setSessionRequests] = useState<SessionRequestRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [msg, setMsg] = useState<string | null>(null);
	const [tab, setTab] = useState<Tab>('analytics');
	const [userSearch, setUserSearch] = useState('');
	const [roleFilter, setRoleFilter] = useState<UserRoleFilter>('all');
	const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('all');
	const scrollY = useRef(new Animated.Value(0)).current;

	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme ?? 'light'];
	const insets = useSafeAreaInsets();
	const headerBackground = colorScheme === 'dark' ? '#1b2236' : '#f4efe4';

	useEffect(() => {
		fetchProfiles();
	}, []);

	useEffect(() => {
		scrollY.setValue(0);
	}, [scrollY, tab]);

	async function fetchProfiles() {
		setLoading(true);
		try {
			const [
				{ data: profileData, error: profileError },
				{ data: applicationData, error: applicationError },
				{ data: messageData, error: messageError },
				{ data: matchData, error: matchError },
				{ data: sessionData, error: sessionError },
			] =
				await Promise.all([
					supabase
						.from('profiles')
						.select('id, full_name, role, title, photo_url, bio, created_at, approval_status, tokens_balance, account_type')
						.order('created_at', { ascending: false }),
					supabase
						.from('applications')
						.select('status, user_type'),
					supabase
						.from('messages')
						.select('thread_id, inserted_at'),
					supabase
						.from('peer_matches')
						.select('created_at'),
					supabase
						.from('mentor_requests')
						.select('status, proposed_at, scheduled_start, tokens_cost'),
				]);

			if (profileError) throw profileError;
			if (applicationError) console.warn('Failed to load application analytics', applicationError);
			if (messageError) console.warn('Failed to load message analytics', messageError);
			if (matchError) console.warn('Failed to load match analytics', matchError);
			if (sessionError) console.warn('Failed to load session analytics', sessionError);

			setProfiles((profileData ?? []) as Profile[]);
			setApplications((applicationData ?? []) as ApplicationRow[]);
			setMessages((messageData ?? []) as MessageRow[]);
			setPeerMatches((matchData ?? []) as MatchRow[]);
			setSessionRequests((sessionData ?? []) as SessionRequestRow[]);
		} catch (e: any) {
			setMsg(e?.message ?? 'Failed to load profiles');
		} finally {
			setLoading(false);
		}
	}

	const pendingProfiles = profiles.filter((p) => p.approval_status === 'pending');
	const getEffectiveRole = (profile: Profile) => (profile.account_type ? 'admin' : (profile.role ?? 'member'));
	const animatedHeaderPaddingTop = scrollY.interpolate({
		inputRange: [0, 140],
		outputRange: [8, 0],
		extrapolate: 'clamp',
	});
	const animatedHeaderPaddingBottom = scrollY.interpolate({
		inputRange: [0, 140],
		outputRange: [18, 10],
		extrapolate: 'clamp',
	});
	const animatedTitleSize = scrollY.interpolate({
		inputRange: [0, 140],
		outputRange: [32, 24],
		extrapolate: 'clamp',
	});
	const animatedTitleLineHeight = scrollY.interpolate({
		inputRange: [0, 140],
		outputRange: [36, 28],
		extrapolate: 'clamp',
	});
	const animatedSubtitleOpacity = scrollY.interpolate({
		inputRange: [0, 90, 140],
		outputRange: [1, 0.35, 0],
		extrapolate: 'clamp',
	});
	const animatedSubtitleHeight = scrollY.interpolate({
		inputRange: [0, 120, 140],
		outputRange: [52, 18, 0],
		extrapolate: 'clamp',
	});
	const animatedLogoScale = scrollY.interpolate({
		inputRange: [0, 140],
		outputRange: [1, 0.72],
		extrapolate: 'clamp',
	});
	const animatedLogoOpacity = scrollY.interpolate({
		inputRange: [0, 120, 140],
		outputRange: [1, 0.7, 0.4],
		extrapolate: 'clamp',
	});
	const scrollHandler = Animated.event(
		[{ nativeEvent: { contentOffset: { y: scrollY } } }],
		{ useNativeDriver: false },
	);

	const allUsersBase = useMemo(() => profiles, [profiles]);

	const filteredAllUsers = useMemo(() => {
		const normalizedSearch = userSearch.trim().toLowerCase();
		return allUsersBase.filter((profile) => {
			const role = getEffectiveRole(profile) as UserRoleFilter;
			const approval = profile.approval_status ?? 'pending';
			if (roleFilter !== 'all' && role !== roleFilter) return false;
			if (approvalFilter !== 'all' && approval !== approvalFilter) return false;
			if (!normalizedSearch) return true;

			const searchFields = [
				profile.full_name,
				profile.title,
				profile.bio,
				role,
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();

			return searchFields.includes(normalizedSearch);
		});
	}, [allUsersBase, approvalFilter, roleFilter, userSearch]);
	const hasActiveUserFilters = userSearch.trim().length > 0 || roleFilter !== 'all' || approvalFilter !== 'all';

	// Group profiles by role for the grid view
	// Admins are always shown (regardless of approval_status); others must be approved
	const groupedByRole = useMemo(() => {
		const groups: { role: string; label: string; users: Profile[] }[] = [];
		for (const r of ROLE_ORDER) {
			const users = filteredAllUsers.filter((p) => getEffectiveRole(p) === r);
			if (users.length > 0) {
				groups.push({ role: r, label: r.charAt(0).toUpperCase() + r.slice(1) + 's', users });
			}
		}
		return groups;
	}, [filteredAllUsers]);

	const analytics = useMemo(() => {
		const now = new Date();
		const startOfToday = new Date();
		startOfToday.setHours(0, 0, 0, 0);
		const daysAgo = (days: number) => {
			const date = new Date(startOfToday);
			date.setDate(date.getDate() - days);
			return date;
		};
		const withinDays = (value: string | null | undefined, days: number) => {
			if (!value) return false;
			const parsed = new Date(value);
			return parsed >= daysAgo(days);
		};
		const countByLastDays = <T,>(items: T[], getDate: (item: T) => string | null | undefined, length: number) =>
			Array.from({ length }, (_, index) => {
				const date = new Date(startOfToday);
				date.setDate(date.getDate() - (length - 1 - index));
				const next = new Date(date);
				next.setDate(next.getDate() + 1);
				return {
					label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
					value: items.filter((item) => {
						const raw = getDate(item);
						if (!raw) return false;
						const parsed = new Date(raw);
						return parsed >= date && parsed < next;
					}).length,
				};
			});

		const totalProfiles = profiles.length;
		const approvedProfiles = profiles.filter((p) => p.approval_status === 'approved').length;
		const pendingCount = profiles.filter((p) => p.approval_status === 'pending').length;
		const rejectedCount = profiles.filter((p) => p.approval_status === 'rejected').length;
		const totalMessages = messages.length;
		const messagesLast7Days = messages.filter((item) => withinDays(item.inserted_at, 6)).length;
		const activeThreadsLast7Days = new Set(
			messages
				.filter((item) => withinDays(item.inserted_at, 6) && item.thread_id != null)
				.map((item) => String(item.thread_id)),
		).size;
		const matchesLast30Days = peerMatches.filter((item) => withinDays(item.created_at, 29)).length;
		const sessionDoneCount = sessionRequests.filter((item) => item.status === 'done').length;
		const scheduledSessionCount = sessionRequests.filter((item) => item.status === 'scheduled').length;
		const requestedSessionCount = sessionRequests.filter((item) => item.status === 'requested').length;
		const cancelledSessionCount = sessionRequests.filter((item) => item.status === 'cancelled').length;
		const totalTokenBalance = profiles.reduce((sum, profile) => sum + (profile.tokens_balance ?? 0), 0);
		const profilesWithTokens = profiles.filter((profile) => (profile.tokens_balance ?? 0) > 0);
		const avgTokenBalance = profiles.length > 0 ? Math.round(totalTokenBalance / profiles.length) : 0;
		const pendingOldestDays = pendingProfiles.reduce((maxDays, profile: any) => {
			if (!profile?.created_at) return maxDays;
			const createdAt = new Date(profile.created_at);
			const days = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
			return Math.max(maxDays, days);
		}, 0);

		const roleMetrics: AnalyticsMetric[] = ROLE_ORDER.map((role) => ({
			label: role.charAt(0).toUpperCase() + role.slice(1),
			value: profiles.filter((p) => getEffectiveRole(p) === role).length,
			color: ROLE_CHART_COLORS[role],
		})).filter((item) => item.value > 0);

		const approvalMetrics: AnalyticsMetric[] = [
			{ label: 'Approved', value: approvedProfiles, color: APPROVAL_CHART_COLORS.approved },
			{ label: 'Pending', value: pendingCount, color: APPROVAL_CHART_COLORS.pending },
			{ label: 'Rejected', value: rejectedCount, color: APPROVAL_CHART_COLORS.rejected },
		].filter((item) => item.value > 0);

		const applicationTypeMetrics: AnalyticsMetric[] = [
			{
				label: 'Mentor applications',
				value: applications.filter((item) => item.user_type === 'mentor').length,
				color: APPLICATION_TYPE_COLORS.mentor,
			},
			{
				label: 'Member applications',
				value: applications.filter((item) => item.user_type === 'member').length,
				color: APPLICATION_TYPE_COLORS.member,
			},
		].filter((item) => item.value > 0);

		const signupsByDay = countByLastDays(profiles, (profile: any) => profile?.created_at, 7);
		const messagesByDay = countByLastDays(messages, (message) => message.inserted_at, 7);

		const sessionStatusMetrics: AnalyticsMetric[] = [
			{ label: 'Requested', value: requestedSessionCount, color: '#c3a76d' },
			{ label: 'Scheduled', value: scheduledSessionCount, color: '#4f6b9a' },
			{ label: 'Completed', value: sessionDoneCount, color: '#4d9b6e' },
			{ label: 'Cancelled', value: cancelledSessionCount, color: '#cf5f5f' },
		].filter((item) => item.value > 0);

		return {
			totalProfiles,
			approvedProfiles,
			pendingCount,
			rejectedCount,
			roleMetrics,
			approvalMetrics,
			applicationTypeMetrics,
			signupsByDay,
			messagesByDay,
			sessionStatusMetrics,
			totalApplications: applications.length,
			totalMessages,
			messagesLast7Days,
			activeThreadsLast7Days,
			totalMatches: peerMatches.length,
			matchesLast30Days,
			sessionDoneCount,
			avgTokenBalance,
			tokenHolderCount: profilesWithTokens.length,
			pendingOldestDays,
		};
	}, [applications, messages, peerMatches, pendingProfiles, profiles, sessionRequests]);

	// Grid layout calculation (used for placeholder alignment)
	const gridColumns = useMemo(() => {
		const available = Math.max(0, screenWidth - GRID_H_PADDING * 2);
		return Math.max(1, Math.floor((available + GRID_GAP) / (GRID_CARD_WIDTH + GRID_GAP)));
	}, []);

	async function approveUser(userId: string) {
		try {
			// Update profile approval status
			const { error } = await supabase
				.from('profiles')
				.update({ approval_status: 'approved' })
				.eq('id', userId)
				.select();

			if (error) {
				console.warn('Approve update error:', JSON.stringify(error));
				throw error;
			}

			// Update matching application row (best-effort)
			const adminUser = (await supabase.auth.getUser()).data.user;
			await supabase
				.from('applications')
				.update({
					status: 'approved',
					reviewed_at: new Date().toISOString(),
					reviewed_by: adminUser?.id ?? null,
				})
				.eq('status', 'pending');

			// Send a push notification (best-effort, don't block on failure)
			supabase.from('notification_events').insert({
				event_type: 'account_approved',
				recipient_user_id: userId,
				title: 'Welcome to Wyttle!',
				body: 'Your account has been approved. You can now access the app.',
				payload: {},
			}).then(({ error: notifError }) => {
				if (notifError) console.warn('Failed to send approval notification', notifError);
			});

			setMsg('User approved');
			await fetchProfiles();
		} catch (e: any) {
			setMsg(e?.message ?? 'Failed to approve user');
		}
	}

	async function rejectUser(userId: string) {
		try {
			const { error } = await supabase
				.from('profiles')
				.update({ approval_status: 'rejected' })
				.eq('id', userId)
				.select();

			if (error) {
				console.warn('Reject update error:', JSON.stringify(error));
				throw error;
			}

			const adminUser = (await supabase.auth.getUser()).data.user;
			await supabase
				.from('applications')
				.update({
					status: 'rejected',
					reviewed_at: new Date().toISOString(),
					reviewed_by: adminUser?.id ?? null,
				})
				.eq('status', 'pending');

			setMsg('User rejected');
			await fetchProfiles();
		} catch (e: any) {
			setMsg(e?.message ?? 'Failed to reject user');
		}
	}

	function confirmReject(userId: string, name?: string) {
		Alert.alert(
			'Reject user',
			`Reject sign-up request from ${name ?? 'this user'}?`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Reject', style: 'destructive', onPress: () => rejectUser(userId) },
			],
		);
	}

	async function setRole(userId: string, newRole: Profile['role']) {
		try {
			const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
			if (error) throw error;
			setMsg('Role updated');
			await fetchProfiles();
		} catch (e: any) {
			setMsg(e?.message ?? 'Failed to update role');
		}
	}

	async function deleteProfile(userId: string) {
		try {
			const { error } = await supabase.from('profiles').delete().eq('id', userId);
			if (error) throw error;
			setMsg('Profile deleted');
			await fetchProfiles();
		} catch (e: any) {
			setMsg(e?.message ?? 'Failed to delete profile');
		}
	}

	function confirmDelete(userId: string, name?: string) {
		Alert.alert(
			'Delete user',
			`Delete profile for ${name ?? 'this user'}? This removes only the profile row; removing the auth account requires a server-side admin action.`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Delete', style: 'destructive', onPress: () => deleteProfile(userId) },
			],
		);
	}

	function viewProfile(userId: string) {
		router.push({ pathname: '/(app)/profile-view', params: { userId } });
	}

	function showUserActions(item: Profile) {
		const role = getEffectiveRole(item);
		const name = item.full_name ?? 'this user';
		const buttons: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' | 'default' }[] = [
			{ text: 'View Profile', onPress: () => viewProfile(item.id) },
		];

		if (role !== 'admin') {
			if (role === 'mentor') {
				buttons.push({ text: 'Demote to Member', onPress: () => setRole(item.id, 'member') });
			} else {
				buttons.push({ text: 'Make Mentor', onPress: () => setRole(item.id, 'mentor') });
			}
			buttons.push({ text: 'Delete', style: 'destructive', onPress: () => confirmDelete(item.id, name) });
		}

		buttons.push({ text: 'Cancel', style: 'cancel' });

		Alert.alert(name, `Role: ${role.charAt(0).toUpperCase() + role.slice(1)}`, buttons);
	}

	function roleColor(role: string | null | undefined) {
		switch (role) {
			case 'admin': return '#e74c3c';
			case 'mentor': return '#968c6c';
			default: return '#333f5c';
		}
	}

	function renderPendingItem({ item }: { item: Profile }) {
		return (
			<View style={[styles.card, { backgroundColor: theme.surface }]}>
				<TouchableOpacity onPress={() => viewProfile(item.id)} activeOpacity={0.7}>
					<View style={styles.cardHeader}>
						{item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarPlaceholder]} />}
						<View style={styles.cardInfo}>
							<ThemedText style={styles.name}>{item.full_name ?? '—'}</ThemedText>
							<Text style={styles.meta}>Wants to join as {getEffectiveRole(item)}</Text>
						</View>
					</View>
					{item.bio ? <Text style={styles.bio} numberOfLines={3}>{item.bio}</Text> : null}
					<Text style={styles.tapHint}>Tap to view full profile</Text>
				</TouchableOpacity>
				<View style={styles.cardActions}>
					<TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => approveUser(item.id)}>
						<Text style={styles.actionBtnText}>Approve</Text>
					</TouchableOpacity>
					<TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => confirmReject(item.id, item.full_name ?? undefined)}>
						<Text style={styles.actionBtnText}>Reject</Text>
					</TouchableOpacity>
				</View>
			</View>
		);
	}

	function renderGridCard(item: Profile, index: number, totalInSection: number) {
		const role = getEffectiveRole(item);

		return (
			<Pressable
				key={item.id}
				onPress={() => viewProfile(item.id)}
				onLongPress={() => showUserActions(item)}
				accessibilityRole="button"
				style={[styles.gridCard, { width: GRID_CARD_WIDTH }]}
			>
				{item.photo_url ? (
					<Image source={{ uri: item.photo_url }} style={styles.gridAvatar} />
				) : (
					<View style={[styles.gridAvatar, styles.gridAvatarPlaceholder]}>
						<Text style={styles.gridAvatarText}>
							{((item.full_name ?? 'U').charAt(0) || 'U').toUpperCase()}
						</Text>
					</View>
				)}
				<Text style={[styles.gridName, { color: theme.text }]} numberOfLines={1}>
					{item.full_name ?? '—'}
				</Text>
				<View style={[styles.gridRoleBadge, { backgroundColor: roleColor(role) }]}>
					<Text style={styles.gridRoleBadgeText}>
						{role.charAt(0).toUpperCase() + role.slice(1)}
					</Text>
				</View>
			</Pressable>
		);
	}

	function renderGridPlaceholders(userCount: number) {
		const remainder = userCount % gridColumns;
		if (remainder === 0) return null;
		return Array.from({ length: gridColumns - remainder }, (_, i) => (
			<View key={`ph-${i}`} style={{ width: GRID_CARD_WIDTH }} />
		));
	}

	function renderMetricCard(label: string, value: string, accent: string) {
		return (
			<View style={[styles.metricCard, { backgroundColor: theme.surface }]}>
				<View style={[styles.metricAccent, { backgroundColor: accent }]} />
				<Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
				<Text style={styles.metricLabel}>{label}</Text>
			</View>
		);
	}

	function renderBarChart(title: string, data: { label: string; value: number; color?: string }[], accentColor: string) {
		const maxValue = Math.max(...data.map((item) => item.value), 1);
		return (
			<View style={[styles.chartCard, { backgroundColor: theme.surface }]}>
				<Text style={[styles.chartTitle, { color: theme.text }]}>{title}</Text>
				<View style={styles.barChart}>
					{data.map((item) => (
						<View key={item.label} style={styles.barChartRow}>
							<View style={styles.barChartLabelWrap}>
								<Text style={styles.barChartLabel}>{item.label}</Text>
							</View>
							<View style={styles.barTrack}>
								<View
									style={[
										styles.barFill,
										{
											width: `${(item.value / maxValue) * 100}%`,
											backgroundColor: item.color ?? accentColor,
										},
									]}
								/>
							</View>
							<Text style={[styles.barChartValue, { color: theme.text }]}>{item.value}</Text>
						</View>
					))}
				</View>
			</View>
		);
	}

	function renderDonutChart(title: string, data: AnalyticsMetric[]) {
		const total = data.reduce((sum, item) => sum + item.value, 0);
		const radius = 44;
		const strokeWidth = 14;
		const circumference = 2 * Math.PI * radius;
		let cumulativePercent = 0;

		return (
			<View style={[styles.chartCard, { backgroundColor: theme.surface }]}>
				<Text style={[styles.chartTitle, { color: theme.text }]}>{title}</Text>
				<View style={styles.donutRow}>
					<View style={styles.donutWrap}>
						<Svg width={120} height={120}>
							<Circle
								cx={60}
								cy={60}
								r={radius}
								stroke={colorScheme === 'dark' ? '#2b3348' : '#e7e1d6'}
								strokeWidth={strokeWidth}
								fill="none"
							/>
							{data.map((item) => {
								const fraction = total > 0 ? item.value / total : 0;
								const strokeDasharray = `${circumference * fraction} ${circumference}`;
								const strokeDashoffset = -circumference * cumulativePercent;
								cumulativePercent += fraction;

								return (
									<Circle
										key={item.label}
										cx={60}
										cy={60}
										r={radius}
										stroke={item.color}
										strokeWidth={strokeWidth}
										fill="none"
										strokeDasharray={strokeDasharray}
										strokeDashoffset={strokeDashoffset}
										strokeLinecap="round"
										rotation={-90}
										origin="60, 60"
									/>
								);
							})}
						</Svg>
						<View style={styles.donutCenter}>
							<Text style={[styles.donutTotalValue, { color: theme.text }]}>{total}</Text>
							<Text style={styles.donutTotalLabel}>Total</Text>
						</View>
					</View>
					<View style={styles.donutLegend}>
						{data.map((item) => (
							<View key={item.label} style={styles.legendRow}>
								<View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
								<Text style={[styles.legendLabel, { color: theme.text }]}>
									{item.label} ({item.value})
								</Text>
							</View>
						))}
					</View>
				</View>
			</View>
		);
	}

	function renderAnalyticsView() {
		return (
			<Animated.ScrollView
				contentContainerStyle={[
					styles.analyticsContainer,
					{ paddingBottom: 120 + (insets.bottom ?? 0) },
				]}
				onScroll={scrollHandler}
				scrollEventThrottle={16}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.metricGrid}>
					{renderMetricCard('Profiles', String(analytics.totalProfiles), '#333f5c')}
					{renderMetricCard('Pending reviews', String(analytics.pendingCount), '#c3a76d')}
					{renderMetricCard('Approved', String(analytics.approvedProfiles), '#4d9b6e')}
					{renderMetricCard('Applications', String(analytics.totalApplications), '#7d89d6')}
					{renderMetricCard('Messages (7d)', String(analytics.messagesLast7Days), '#4f6b9a')}
					{renderMetricCard('Active chats (7d)', String(analytics.activeThreadsLast7Days), '#7d89d6')}
					{renderMetricCard('New matches (30d)', String(analytics.matchesLast30Days), '#968c6c')}
					{renderMetricCard('Sessions done', String(analytics.sessionDoneCount), '#4d9b6e')}
					{renderMetricCard('Avg tokens', String(analytics.avgTokenBalance), '#d28f3f')}
					{renderMetricCard('Oldest pending (days)', String(analytics.pendingOldestDays), '#cf5f5f')}
				</View>

				{analytics.approvalMetrics.length > 0
					? renderDonutChart('Approval Status', analytics.approvalMetrics)
					: null}
				{analytics.roleMetrics.length > 0
					? renderBarChart('User Roles', analytics.roleMetrics, '#968c6c')
					: null}
				{renderBarChart('Recent Sign-ups', analytics.signupsByDay, '#4f6b9a')}
				{renderBarChart('Messages Last 7 Days', analytics.messagesByDay, '#7d89d6')}
				{analytics.applicationTypeMetrics.length > 0
					? renderBarChart('Application Types', analytics.applicationTypeMetrics, '#7d89d6')
					: null}
				{analytics.sessionStatusMetrics.length > 0
					? renderBarChart('Session Pipeline', analytics.sessionStatusMetrics, '#4d9b6e')
					: null}
			</Animated.ScrollView>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: headerBackground }]}>
			<SafeAreaView
				edges={['top']}
				style={{ backgroundColor: headerBackground }}
			>
				<Animated.View
					style={[
						styles.headerSection,
						{
							paddingTop: animatedHeaderPaddingTop,
							paddingBottom: animatedHeaderPaddingBottom,
							backgroundColor: headerBackground,
							borderBottomColor: colorScheme === 'dark' ? '#ffffff12' : '#0000000d',
						},
					]}
				>
				<View style={styles.headerTopRow}>
					<BackButton style={styles.headerBackButton} />
				</View>
				<Animated.View style={styles.headerBody}>
					<View style={styles.headerCopy}>
						<Text
							style={[
								styles.headerEyebrow,
								{ color: colorScheme === 'dark' ? '#cfd3ff' : '#6f6a5c' },
							]}
						>
							Admin tools
						</Text>
						<Animated.Text style={[styles.headerTitle, { color: theme.text, fontSize: animatedTitleSize, lineHeight: animatedTitleLineHeight }]}>
							Admin Panel
						</Animated.Text>
						<Animated.View style={{ opacity: animatedSubtitleOpacity, height: animatedSubtitleHeight, overflow: 'hidden' }}>
							<ThemedText
								darkColor="#c7cee8"
								style={[styles.headerSubtitle, { color: colorScheme === 'dark' ? '#c7cee8' : '#6f7282' }]}
							>
								Review pending applications and manage approved users.
							</ThemedText>
						</Animated.View>
					</View>
					<Animated.View style={[styles.headerLogoWrap, { opacity: animatedLogoOpacity, transform: [{ scale: animatedLogoScale }] }]}>
						<Logo size={56} />
					</Animated.View>
				</Animated.View>
				</Animated.View>
			</SafeAreaView>

			<View style={[styles.contentSection, { backgroundColor: theme.background }]}>
				{/* Tab bar */}
				<View
					style={[
						styles.tabBar,
						{ paddingTop: 14, backgroundColor: theme.background },
					]}
				>
					<TouchableOpacity
						style={[styles.tab, tab === 'analytics' && styles.tabActive]}
						onPress={() => setTab('analytics')}
					>
						<Text style={[styles.tabText, tab === 'analytics' && styles.tabTextActive]}>Analytics</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.tab, tab === 'pending' && styles.tabActive]}
						onPress={() => setTab('pending')}
					>
						<View style={styles.tabContent}>
							<Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
								Pending
							</Text>
							<View
								style={[
									styles.tabBadge,
									tab === 'pending' && styles.tabBadgeActive,
								]}
							>
								<Text
									style={[
										styles.tabBadgeText,
										tab === 'pending' && styles.tabBadgeTextActive,
									]}
								>
									{pendingProfiles.length}
								</Text>
							</View>
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.tab, tab === 'all' && styles.tabActive]}
						onPress={() => setTab('all')}
					>
						<Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>All Users</Text>
					</TouchableOpacity>
				</View>

				{loading ? (
					<ActivityIndicator size="large" style={{ marginTop: 24 }} />
				) : tab === 'pending' ? (
					pendingProfiles.length === 0 ? (
						<View style={styles.empty}>
							<Text style={styles.emptyText}>No pending sign-up requests</Text>
						</View>
					) : (
						<AnimatedFlatList
							data={pendingProfiles}
							keyExtractor={(p) => p.id}
							renderItem={renderPendingItem}
							onScroll={scrollHandler}
							scrollEventThrottle={16}
							contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 120 + (insets.bottom ?? 0) }}
						/>
					)
				) : tab === 'all' ? (
					/* All Users – grid view grouped by role */
					<Animated.ScrollView
						contentContainerStyle={[
							styles.gridScrollContainer,
							{ paddingHorizontal: 16, paddingBottom: 120 + (insets.bottom ?? 0) },
						]}
						onScroll={scrollHandler}
						scrollEventThrottle={16}
						showsVerticalScrollIndicator={true}
					>
						<View style={[styles.filtersCard, { backgroundColor: theme.surface }]}>
							<TextInput
								value={userSearch}
								onChangeText={setUserSearch}
								placeholder="Search name, role, title"
								placeholderTextColor={colorScheme === 'dark' ? '#8e96b5' : '#9a9a9a'}
								style={[
									styles.searchInput,
									{
										color: theme.text,
										backgroundColor: colorScheme === 'dark' ? '#232b40' : '#ffffff',
										borderColor: colorScheme === 'dark' ? '#ffffff14' : '#dcd4c6',
									},
								]}
							/>
							<View style={styles.filterGroup}>
								<Text style={styles.filterLabel}>Role</Text>
								<View style={styles.filterRow}>
									{USER_ROLE_FILTERS.map((option) => {
										const isActive = roleFilter === option.value;
										return (
											<TouchableOpacity
												key={option.value}
												style={[
													styles.filterChip,
													{
														backgroundColor: isActive
															? '#968c6c'
															: colorScheme === 'dark'
																? '#232b40'
																: '#f3ede2',
														borderColor: isActive
															? '#968c6c'
															: colorScheme === 'dark'
																? '#ffffff14'
																: '#dfd5c3',
													},
												]}
												onPress={() => setRoleFilter(option.value)}
											>
												<Text
													style={[
														styles.filterChipText,
														{ color: isActive ? '#ffffff' : theme.text },
													]}
												>
													{option.label}
												</Text>
											</TouchableOpacity>
										);
									})}
								</View>
							</View>
							<View style={styles.filterGroup}>
								<Text style={styles.filterLabel}>Approval</Text>
								<View style={styles.filterRow}>
									{USER_APPROVAL_FILTERS.map((option) => {
										const isActive = approvalFilter === option.value;
										return (
											<TouchableOpacity
												key={option.value}
												style={[
													styles.filterChip,
													{
														backgroundColor: isActive
															? '#333f5c'
															: colorScheme === 'dark'
																? '#232b40'
																: '#f3ede2',
														borderColor: isActive
															? '#333f5c'
															: colorScheme === 'dark'
																? '#ffffff14'
																: '#dfd5c3',
													},
												]}
												onPress={() => setApprovalFilter(option.value)}
											>
												<Text
													style={[
														styles.filterChipText,
														{ color: isActive ? '#ffffff' : theme.text },
													]}
												>
													{option.label}
												</Text>
											</TouchableOpacity>
										);
									})}
								</View>
							</View>
							<View style={styles.filterFooter}>
								<Text style={styles.filterSummary}>
									Showing {filteredAllUsers.length} user{filteredAllUsers.length === 1 ? '' : 's'}
								</Text>
								{hasActiveUserFilters ? (
									<TouchableOpacity
										onPress={() => {
											setUserSearch('');
											setRoleFilter('all');
											setApprovalFilter('all');
										}}
									>
										<Text style={styles.clearFiltersText}>Clear filters</Text>
									</TouchableOpacity>
								) : null}
							</View>
						</View>
						<Text style={styles.gridHint}>Long-press a profile for admin actions</Text>
						{groupedByRole.length === 0 ? (
							<View style={styles.inlineEmptyState}>
								<Text style={styles.emptyText}>No users found for the current filters</Text>
							</View>
						) : (
							groupedByRole.map((group) => (
								<View key={group.role} style={styles.gridSection}>
									<Text style={[styles.gridSectionHeader, { color: theme.text }]}>
										{group.label} ({group.users.length})
									</Text>
									<View style={styles.gridInner}>
										{group.users.map((user, idx) => renderGridCard(user, idx, group.users.length))}
										{renderGridPlaceholders(group.users.length)}
									</View>
								</View>
							))
						)}
					</Animated.ScrollView>
				) : (
					renderAnalyticsView()
				)}
			</View>

			<Toast visible={!!msg} message={msg ?? ''} onDismiss={() => setMsg(null)} />
			{/* include main app nav so admins can navigate like other users */}
			<MentorBottomNav />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	contentSection: {
		flex: 1,
	},
	headerSection: {
		paddingHorizontal: 20,
		paddingBottom: 18,
		borderBottomWidth: 1,
	},
	headerTopRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 10,
	},
	headerBackButton: {
		marginTop: 0,
		marginBottom: 0,
		marginLeft: 0,
	},
	headerCopy: {
		flex: 1,
		paddingRight: 12,
	},
	headerBody: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: 12,
	},
	headerLogoWrap: {
		paddingTop: 8,
		alignItems: 'flex-end',
	},
	headerEyebrow: {
		fontSize: 13,
		fontWeight: '600',
		letterSpacing: 0.3,
		marginBottom: 6,
		textTransform: 'uppercase',
	},
	headerTitle: {
		fontSize: 32,
		lineHeight: 36,
		fontWeight: '700',
	},
	headerSubtitle: {
		marginTop: 6,
		fontSize: 15,
		lineHeight: 21,
	},
	tabBar: {
		flexDirection: 'row',
		paddingHorizontal: 16,
		paddingBottom: 10,
		gap: 8,
	},
	tab: {
		flex: 1,
		paddingVertical: 12,
		borderRadius: 12,
		backgroundColor: '#e0e0e0',
		alignItems: 'center',
	},
	tabContent: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	tabActive: {
		backgroundColor: '#968c6c',
	},
	tabText: {
		fontSize: 14,
		fontWeight: '600',
		color: '#666',
	},
	tabTextActive: {
		color: '#fff',
	},
	tabBadge: {
		minWidth: 22,
		paddingHorizontal: 7,
		paddingVertical: 3,
		borderRadius: 999,
		backgroundColor: '#b7b0a0',
		alignItems: 'center',
		justifyContent: 'center',
	},
	tabBadgeActive: {
		backgroundColor: '#f5ecce',
	},
	tabBadgeText: {
		fontSize: 12,
		fontWeight: '700',
		color: '#333f5c',
	},
	tabBadgeTextActive: {
		color: '#6b6249',
	},
	empty: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	emptyText: {
		fontSize: 15,
		color: '#999',
	},
	card: {
		padding: 14,
		borderRadius: 10,
		marginBottom: 10,
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	cardInfo: {
		flex: 1,
		marginLeft: 12,
	},
	avatar: {
		width: 44,
		height: 44,
		borderRadius: 22,
		borderWidth: 1,
		borderColor: '#d5ccba',
	},
	avatarPlaceholder: { backgroundColor: '#d0d0d0' },
	name: { fontSize: 16, fontWeight: '600' },
	meta: { fontSize: 12, color: '#888', marginTop: 2 },
	bio: { fontSize: 13, color: '#888', marginTop: 8, lineHeight: 18 },
	tapHint: { fontSize: 12, color: '#aaa', marginTop: 6, fontStyle: 'italic' },
	cardActions: {
		flexDirection: 'row',
		gap: 8,
		marginTop: 12,
	},
	actionBtn: {
		flex: 1,
		paddingVertical: 8,
		borderRadius: 6,
		alignItems: 'center',
	},
	actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
	approveBtn: { backgroundColor: '#2ecc71' },
	rejectBtn: { backgroundColor: '#e74c3c' },
	/* ── Grid styles (All Users tab) ── */
	gridScrollContainer: {
		paddingTop: 6,
	},
	filtersCard: {
		borderRadius: 18,
		padding: 14,
		marginBottom: 12,
	},
	searchInput: {
		height: 46,
		borderWidth: 1,
		borderRadius: 14,
		paddingHorizontal: 14,
		fontSize: 15,
		marginBottom: 14,
	},
	filterGroup: {
		marginBottom: 12,
	},
	filterLabel: {
		fontSize: 12,
		fontWeight: '700',
		letterSpacing: 0.3,
		textTransform: 'uppercase',
		color: '#8b8578',
		marginBottom: 8,
	},
	filterRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	filterChip: {
		borderWidth: 1,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	filterChipText: {
		fontSize: 13,
		fontWeight: '600',
	},
	filterSummary: {
		fontSize: 13,
		color: '#7d7d7d',
	},
	filterFooter: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	clearFiltersText: {
		fontSize: 13,
		fontWeight: '700',
		color: '#4f6b9a',
	},
	gridHint: {
		fontSize: 12,
		color: '#999',
		fontStyle: 'italic',
		marginBottom: 10,
	},
	inlineEmptyState: {
		paddingVertical: 28,
		alignItems: 'center',
	},
	gridSection: {
		width: '100%',
		marginBottom: 8,
	},
	gridSectionHeader: {
		fontSize: 15,
		fontWeight: '700',
		marginBottom: 10,
	},
	gridInner: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignItems: 'flex-start',
		justifyContent: 'flex-start',
		gap: GRID_GAP,
	},
	gridCard: {
		alignItems: 'center',
	},
	gridAvatar: {
		width: GRID_AVATAR_SIZE,
		height: GRID_AVATAR_SIZE,
		borderRadius: GRID_AVATAR_SIZE / 2,
		marginBottom: 4,
		borderWidth: 1,
		borderColor: '#d5ccba',
	},
	gridAvatarPlaceholder: {
		backgroundColor: '#d0d0d0',
		alignItems: 'center',
		justifyContent: 'center',
	},
	gridAvatarText: {
		color: '#333',
		fontSize: 18,
		fontWeight: '700',
	},
	gridName: {
		fontSize: 12,
		textAlign: 'center',
		marginBottom: 3,
	},
	gridRoleBadge: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 4,
	},
	gridRoleBadgeText: {
		color: '#fff',
		fontSize: 10,
		fontWeight: '700',
	},
	analyticsContainer: {
		paddingHorizontal: 16,
		paddingTop: 6,
		gap: 14,
	},
	metricGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
	},
	metricCard: {
		width: '48%',
		borderRadius: 18,
		paddingHorizontal: 16,
		paddingVertical: 16,
	},
	metricAccent: {
		width: 34,
		height: 5,
		borderRadius: 999,
		marginBottom: 12,
	},
	metricValue: {
		fontSize: 28,
		fontWeight: '700',
		marginBottom: 4,
	},
	metricLabel: {
		fontSize: 13,
		color: '#7d7d7d',
	},
	chartCard: {
		borderRadius: 20,
		paddingHorizontal: 16,
		paddingVertical: 18,
	},
	chartTitle: {
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 16,
	},
	barChart: {
		gap: 12,
	},
	barChartRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	barChartLabelWrap: {
		width: 92,
	},
	barChartLabel: {
		fontSize: 13,
		color: '#7d7d7d',
	},
	barTrack: {
		flex: 1,
		height: 10,
		borderRadius: 999,
		backgroundColor: '#d8dbe2',
		overflow: 'hidden',
	},
	barFill: {
		height: '100%',
		borderRadius: 999,
	},
	barChartValue: {
		width: 28,
		textAlign: 'right',
		fontSize: 13,
		fontWeight: '600',
	},
	donutRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 18,
	},
	donutWrap: {
		width: 120,
		height: 120,
		alignItems: 'center',
		justifyContent: 'center',
	},
	donutCenter: {
		position: 'absolute',
		alignItems: 'center',
	},
	donutTotalValue: {
		fontSize: 22,
		fontWeight: '700',
	},
	donutTotalLabel: {
		fontSize: 12,
		color: '#7d7d7d',
	},
	donutLegend: {
		flex: 1,
		gap: 10,
	},
	legendRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	legendSwatch: {
		width: 12,
		height: 12,
		borderRadius: 999,
		marginRight: 10,
	},
	legendLabel: {
		fontSize: 14,
	},
});
