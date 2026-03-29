import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Trash2, Search, Pencil } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { z } from 'zod';

const AVAILABLE_PERMISSIONS = [
  { id: 'view_dashboard', label: 'Dashboard', description: 'Access admin dashboard' },
  { id: 'manage_menu', label: 'Menu Management', description: 'Create, edit, and delete menu items' },
  { id: 'manage_branches', label: 'Branch Management', description: 'Manage restaurant branches' },
  { id: 'manage_customise', label: 'Customise', description: 'Customize app appearance' },
  { id: 'manage_orders', label: 'Order Management', description: 'View and manage orders' },
  { id: 'manage_reservations', label: 'Reservations', description: 'Manage table reservations' },
  { id: 'manage_staff', label: 'Staff Management', description: 'Create and manage staff and delivery drivers' },
  { id: 'view_customers', label: 'Customers', description: 'View customer information' },
  { id: 'view_statistics', label: 'Statistics', description: 'View statistics and analytics' },
  { id: 'view_reports', label: 'Reports', description: 'View and generate reports' },
  { id: 'manage_broadcast', label: 'Broadcast', description: 'Send broadcast notifications' },
  { id: 'manage_qr_menu', label: 'QR Code for Menu', description: 'Manage QR code menu access' },
  { id: 'manage_configure', label: 'Configuration', description: 'System configuration' },
];

const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin: currentUserIsAdmin } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'manager' | 'staff' | 'delivery'>('staff');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [editBranchId, setEditBranchId] = useState<string>('');

  // Fetch the current user's branch assignment (for managers)
  const { data: currentUserBranch } = useQuery({
    queryKey: ['current-user-branch'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('staff_branches')
        .select('branch_id, branches(name, city)')
        .eq('user_id', user.id)
        .maybeSingle();
      return data ? { id: data.branch_id, name: (data.branches as any)?.name, city: (data.branches as any)?.city } : null;
    },
    enabled: !currentUserIsAdmin,
  });

  // Load branches
  const { data: branches } = useQuery({
    queryKey: ['branches-for-staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, city')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // For non-admin managers, only show their assigned branch
  const availableBranches = currentUserIsAdmin
    ? branches
    : branches?.filter(b => b.id === currentUserBranch?.id);

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['staff-users'],
    queryFn: async () => {
      // Fetch all user roles for staff members
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .in('role', ['manager', 'staff', 'delivery'])
        .order('created_at', { ascending: false });
      
      if (rolesError) {
        console.error('Error fetching staff users:', rolesError);
        throw rolesError;
      }

      console.log('Fetched staff roles:', rolesData?.length || 0);

      if (!rolesData || rolesData.length === 0) {
        return [];
      }

      // Fetch profiles, permissions and branch assignments for each user
      const usersWithDetails = await Promise.all(
        rolesData.map(async (role) => {
          // Get profile data
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, phone')
            .eq('id', role.user_id)
            .maybeSingle();
          
          // Get permissions
          const { data: perms } = await supabase
            .from('user_permissions')
            .select('permission')
            .eq('user_id', role.user_id);

          // Get branch assignment
          const { data: branchAssignment } = await supabase
            .from('staff_branches')
            .select('branch_id, branches(name, city)')
            .eq('user_id', role.user_id)
            .maybeSingle();
          
          return {
            ...role,
            profiles: profile,
            permissions: perms?.map(p => p.permission) || [],
            branch: branchAssignment ? {
              id: branchAssignment.branch_id,
              name: (branchAssignment.branches as any)?.name,
              city: (branchAssignment.branches as any)?.city,
            } : null,
          };
        })
      );

      console.log('Fetched users with details:', usersWithDetails.length);
      return usersWithDetails;
    },
    refetchInterval: 5000, // Refetch every 5 seconds to catch new users
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      // Validate password strength
      const passwordValidation = passwordSchema.safeParse(password);
      if (!passwordValidation.success) {
        throw new Error(passwordValidation.error.errors[0].message);
      }
      
      // Call edge function to create user (doesn't affect current session)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
          permissions: role === 'manager' ? selectedPermissions : [],
          branch_id: selectedBranchId || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      return result;
    },
    onSuccess: async () => {
      // Invalidate and refetch to ensure fresh data
      await queryClient.invalidateQueries({ queryKey: ['staff-users'] });
      await queryClient.refetchQueries({ queryKey: ['staff-users'] });
      
      toast({ title: 'User created successfully' });
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('staff');
      setSelectedPermissions([]);
      setSelectedBranchId('');
    },
    onError: (error: any) => {
      console.error('User creation error:', error);
      
      let message = "Failed to create user. Please try again.";
      
      // Handle specific error cases
      if (error.message.includes("Password")) {
        message = error.message;
      } else if (error.message.includes("already registered") || error.message.includes("already exists") || error.message.includes("Email already registered")) {
        message = "This email is already registered. Please use a different email.";
      } else if (error.message.includes("Invalid email")) {
        message = "Please enter a valid email address.";
      } else if (error.message.includes("Unauthorized") || error.message.includes("Insufficient permissions")) {
        message = "You don't have permission to create users.";
      } else if (error.message.includes("Failed to assign role")) {
        message = "User created but role assignment failed. Please contact support.";
      } else if (error.message) {
        message = error.message;
      }
      
      toast({ 
        title: 'Error creating user', 
        description: message,
        variant: 'destructive',
        duration: 6000 // Show error longer
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: string[] }) => {
      // Delete existing permissions
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      // Insert new permissions
      if (permissions.length > 0) {
        const permissionsToInsert = permissions.map(permission => ({
          user_id: userId,
          permission,
        }));

        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
      toast({ title: 'Permissions updated successfully' });
      setEditingUser(null);
      setEditPermissions([]);
    },
    onError: () => {
      toast({ 
        title: 'Error updating permissions',
        variant: 'destructive'
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-staff-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
      toast({ title: 'User deleted successfully', description: 'The account has been permanently removed.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error deleting user', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate();
  };

  const handleEditPermissions = (user: any) => {
    setEditingUser(user);
    setEditPermissions(user.permissions || []);
  };

  const handleSavePermissions = () => {
    if (editingUser) {
      updatePermissionsMutation.mutate({
        userId: editingUser.user_id,
        permissions: editPermissions,
      });
    }
  };

  const togglePermission = (permissionId: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditPermissions(prev =>
        prev.includes(permissionId)
          ? prev.filter(p => p !== permissionId)
          : [...prev, permissionId]
      );
    } else {
      setSelectedPermissions(prev =>
        prev.includes(permissionId)
          ? prev.filter(p => p !== permissionId)
          : [...prev, permissionId]
      );
    }
  };

  const filteredUsers = users?.filter(user => {
    // Non-admin users (managers) cannot see other managers
    if (!currentUserIsAdmin && user.role === 'manager') return false;
    
    // Non-admin managers can only see staff from their own branch
    if (!currentUserIsAdmin && currentUserBranch) {
      if (user.branch?.id !== currentUserBranch.id) return false;
    }
    
    const searchLower = searchQuery.toLowerCase();
    const profile = user.profiles as any;
    return (
      profile?.full_name?.toLowerCase().includes(searchLower) ||
      profile?.phone?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage staff, managers, and delivery personnel</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Create New User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="user@example.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Must be a unique email address
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={12}
                    placeholder="Min 12 chars, uppercase, lowercase & number"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    At least 12 characters with uppercase, lowercase, and numbers
                  </p>
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={(value: any) => setRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentUserIsAdmin && <SelectItem value="manager">Manager</SelectItem>}
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Branch Assignment */}
              <div>
                <Label htmlFor="branch">Assign to Branch</Label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBranches?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} — {b.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Staff will only see orders from their assigned branch
                </p>
              </div>

              {role === 'manager' && (
                <div className="space-y-3">
                  <Label>Manager Permissions</Label>
                  <p className="text-sm text-muted-foreground">Select which sections this manager can access</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-lg">
                    {AVAILABLE_PERMISSIONS.map((perm) => (
                      <div key={perm.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={`perm-${perm.id}`}
                          checked={selectedPermissions.includes(perm.id)}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        <div className="space-y-1">
                          <label
                            htmlFor={`perm-${perm.id}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {perm.label}
                          </label>
                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff Members</CardTitle>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search staff by name, phone, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredUsers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">No staff members found</TableCell>
                  </TableRow>
                ) : (
                  filteredUsers?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{(user.profiles as any)?.full_name || 'N/A'}</TableCell>
                      <TableCell>{(user.profiles as any)?.phone || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'manager' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          disabled={!currentUserIsAdmin}
                          value={user.branch?.id || ''}
                          onValueChange={async (branchId) => {
                            try {
                              // Delete existing assignment
                              await supabase
                                .from('staff_branches')
                                .delete()
                                .eq('user_id', user.user_id);
                              // Insert new assignment
                              if (branchId) {
                                await supabase
                                  .from('staff_branches')
                                  .insert({ user_id: user.user_id, branch_id: branchId });
                              }
                              queryClient.invalidateQueries({ queryKey: ['staff-users'] });
                              toast({ title: 'Branch updated' });
                            } catch (err) {
                              toast({ title: 'Failed to update branch', variant: 'destructive' });
                            }
                          }}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="No branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableBranches?.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {user.role === 'manager' ? (
                          user.permissions?.length > 0 ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="flex flex-wrap gap-1 items-center hover:opacity-80 transition-opacity">
                                  {user.permissions.slice(0, 2).map((perm: string) => (
                                    <Badge key={perm} variant="outline" className="text-xs">
                                      {AVAILABLE_PERMISSIONS.find(p => p.id === perm)?.label || perm}
                                    </Badge>
                                  ))}
                                  {user.permissions.length > 2 && (
                                    <Badge variant="secondary" className="text-xs cursor-pointer">
                                      +{user.permissions.length - 2} more
                                    </Badge>
                                  )}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80" align="start">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">All Permissions</h4>
                                  <div className="grid grid-cols-1 gap-2">
                                    {user.permissions.map((perm: string) => {
                                      const permDef = AVAILABLE_PERMISSIONS.find(p => p.id === perm);
                                      return (
                                        <div key={perm} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">{permDef?.label || perm}</p>
                                            <p className="text-xs text-muted-foreground">{permDef?.description}</p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className="text-xs text-muted-foreground">No permissions</span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {user.role === 'manager' && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleEditPermissions(user)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Permissions - {(user.profiles as any)?.full_name}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 gap-3 p-4 border rounded-lg">
                                    {AVAILABLE_PERMISSIONS.map((perm) => (
                                      <div key={perm.id} className="flex items-start space-x-2">
                                        <Checkbox
                                          id={`edit-perm-${perm.id}`}
                                          checked={editPermissions.includes(perm.id)}
                                          onCheckedChange={() => togglePermission(perm.id, true)}
                                        />
                                        <div className="space-y-1">
                                          <label
                                            htmlFor={`edit-perm-${perm.id}`}
                                            className="text-sm font-medium leading-none cursor-pointer"
                                          >
                                            {perm.label}
                                          </label>
                                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setEditingUser(null)}>
                                      Cancel
                                    </Button>
                                    <Button 
                                      onClick={handleSavePermissions}
                                      disabled={updatePermissionsMutation.isPending}
                                    >
                                      {updatePermissionsMutation.isPending ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove this user's role? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction disabled={deleteUserMutation.isPending} onClick={() => deleteUserMutation.mutate(user.user_id)}>
                                  {deleteUserMutation.isPending ? 'Removing...' : 'Remove'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
