import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable, ActivityIndicator, Alert, Image, ScrollView, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { supabase, Profile } from '../../../src/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Toast } from '@/components/ui/Toast';
import { BackButton } from '@/components/ui/BackButton';
import MentorBottomNav from '../../../src/components/nav/MentorBottomNav';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GRID_CARD_WIDTH = 100;
const GRID_GAP = 15;
const GRID_H_PADDING = 12;
const GRID_AVATAR_SIZE = 56;
const screenWidth = Dimensions.get('window').width;

type Tab = 'pending' | 'all';

export default function AdminPanel() {
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [loading, setLoading] = useState(true);
	const [msg, setMsg] = useState<string | null>(null);
	const [tab, setTab] = useState<Tab>('pending');

	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme ?? 'light'];
	const insets = useSafeAreaInsets();

	useEffect(() => {
		fetchProfiles();
	}, []);

	async function fetchProfiles() {
		setLoading(true);
		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('id, full_name, role, title, photo_url, bio, created_at, approval_status')
				.order('created_at', { ascending: false });

			if (error) throw error;
			setProfiles((data ?? []) as Profile[]);
		} catch (e: any) {
			setMsg(e?.message ?? 'Failed to load profiles');
		} finally {
			setLoading(false);
		}
	}

	const pendingProfiles = profiles.filter((p) => p.approval_status === 'pending');

	// Group profiles by role for the grid view
	// Admins are always shown (regardless of approval_status); others must be approved
	const roleOrder = ['admin', 'mentor', 'member'] as const;
	const groupedByRole = useMemo(() => {
		const groups: { role: string; label: string; users: Profile[] }[] = [];
		for (const r of roleOrder) {
			const users = profiles.filter((p) => {
				if ((p.role ?? 'member') !== r) return false;
				// Always show admins; for others require approved status
				return r === 'admin' || p.approval_status === 'approved';
			});
			if (users.length > 0) {
				groups.push({ role: r, label: r.charAt(0).toUpperCase() + r.slice(1) + 's', users });
			}
		}
		return groups;
	}, [profiles]);

	// Grid layout calculation (used for placeholder alignment)
	const gridColumns = useMemo(() => {
		const available = Math.max(0, screenWidth - GRID_H_PADDING * 2);
		return Math.max(1, Math.floor((available + GRID_GAP) / (GRID_CARD_WIDTH + GRID_GAP)));
	}, []);

	async function approveUser(userId: string) {
		try {
			// Update profile approval status
			const { error, count } = await supabase
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
		const role = item.role ?? 'member';
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
							<Text style={styles.meta}>Wants to join as {item.role ?? 'member'}</Text>
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
		const role = item.role ?? 'member';

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
		const count = gridColumns - remainder;
		return Array.from({ length: count }, (_, i) => (
			<View key={`ph-${i}`} style={{ width: GRID_CARD_WIDTH }} />
		));
	}

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<BackButton style={{ marginLeft: 12 }} />
			<ScreenHeader title="Admin" />

			{/* Tab bar */}
			<View style={styles.tabBar}>
				<TouchableOpacity
					style={[styles.tab, tab === 'pending' && styles.tabActive]}
					onPress={() => setTab('pending')}
				>
					<Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
						Pending{pendingProfiles.length > 0 ? ` (${pendingProfiles.length})` : ''}
					</Text>
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
					<FlatList
						data={pendingProfiles}
						keyExtractor={(p) => p.id}
						renderItem={renderPendingItem}
						contentContainerStyle={{ padding: 12 }}
					/>
				)
			) : (
				/* All Users – grid view grouped by role */
				groupedByRole.length === 0 ? (
					<View style={styles.empty}>
						<Text style={styles.emptyText}>No users found</Text>
					</View>
				) : (
					<ScrollView
						contentContainerStyle={[
							styles.gridScrollContainer,
							{ paddingHorizontal: GRID_H_PADDING, paddingBottom: 120 + (insets.bottom ?? 0) },
						]}
						showsVerticalScrollIndicator={true}
					>
						<Text style={styles.gridHint}>Long-press a profile for admin actions</Text>
						{groupedByRole.map((group) => (
							<View key={group.role} style={styles.gridSection}>
								<Text style={[styles.gridSectionHeader, { color: theme.text }]}>
									{group.label} ({group.users.length})
								</Text>
								<View style={styles.gridInner}>
									{group.users.map((user, idx) => renderGridCard(user, idx, group.users.length))}
									{renderGridPlaceholders(group.users.length)}
								</View>
							</View>
						))}
					</ScrollView>
				)
			)}

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
	tabBar: {
		flexDirection: 'row',
		paddingHorizontal: 12,
		paddingTop: 4,
		paddingBottom: 8,
		gap: 8,
	},
	tab: {
		flex: 1,
		paddingVertical: 10,
		borderRadius: 8,
		backgroundColor: '#e0e0e0',
		alignItems: 'center',
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
	avatar: { width: 44, height: 44, borderRadius: 22 },
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
		paddingTop: 4,
	},
	gridHint: {
		fontSize: 12,
		color: '#999',
		fontStyle: 'italic',
		marginBottom: 10,
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
});

