import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { supabase, Profile } from '../../../src/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Toast } from '@/components/ui/Toast';
import { BackButton } from '@/components/ui/BackButton';
import MentorBottomNav from '../../../src/components/nav/MentorBottomNav';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function AdminPanel() {
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [loading, setLoading] = useState(true);
	const [msg, setMsg] = useState<string | null>(null);

	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme ?? 'light'];

	useEffect(() => {
		fetchProfiles();
	}, []);

	async function fetchProfiles() {
		setLoading(true);
		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('id, full_name, role, title, photo_url, created_at')
				.order('created_at', { ascending: false });

			if (error) throw error;
			setProfiles((data ?? []) as Profile[]);
		} catch (e: any) {
			setMsg(e?.message ?? 'Failed to load profiles');
		} finally {
			setLoading(false);
		}
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

	function renderItem({ item }: { item: Profile }) {
		return (
			<View style={[styles.row, { backgroundColor: theme.surface }]}
			>
				<View style={styles.left}>
					{item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.avatar} /> : null}
					<View style={styles.info}>
						<ThemedText style={styles.name}>{item.full_name ?? '—'}</ThemedText>
						<Text style={styles.meta}>{item.title ?? ''} • {item.role ?? 'member'}</Text>
					</View>
				</View>

				<View style={styles.actions}>
					{item.role !== 'mentor' && (
						<TouchableOpacity style={[styles.button, styles.approve]} onPress={() => setRole(item.id, 'mentor')}>
							<Text style={styles.buttonText}>Approve</Text>
						</TouchableOpacity>
					)}
					{item.role === 'mentor' && (
						<TouchableOpacity style={[styles.button, styles.deny]} onPress={() => setRole(item.id, 'member')}>
							<Text style={styles.buttonText}>Revoke</Text>
						</TouchableOpacity>
					)}

					<TouchableOpacity style={[styles.button, styles.delete]} onPress={() => confirmDelete(item.id, item.full_name ?? undefined)}>
						<Text style={styles.buttonText}>Delete</Text>
					</TouchableOpacity>
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}
		>
			<BackButton style={{ marginLeft: 12 }} />
			<ScreenHeader title="Admin" />

			{loading ? (
				<ActivityIndicator size="large" style={{ marginTop: 24 }} />
			) : (
				<FlatList
					data={profiles}
					keyExtractor={(p) => p.id}
					renderItem={renderItem}
					contentContainerStyle={{ padding: 12 }}
				/>
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
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		borderRadius: 8,
		marginBottom: 10,
	},
	left: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
	},
	avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
	info: {},
	name: { fontSize: 16, fontWeight: '600' },
	meta: { fontSize: 12, color: '#666' },
	actions: { flexDirection: 'row', gap: 8 },
	button: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 6,
		marginLeft: 8,
	},
	approve: { backgroundColor: '#2ecc71' },
	deny: { backgroundColor: '#f1c40f' },
	delete: { backgroundColor: '#e74c3c' },
	buttonText: { color: '#fff', fontWeight: '600' },
});

