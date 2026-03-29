import { useState } from 'react';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { UnsavedChangesDialog } from '@/components/admin/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Mail, Smartphone, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface BroadcastNotification {
  id: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  recipient_filter: string;
  sent_at: string | null;
  sent_count: number;
  created_at: string;
}

const channelIcons: Record<string, any> = {
  email: Mail,
  push: Smartphone,
  both: Send,
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  sending: { label: 'Sending', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
};

export const NotificationsTab = () => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('email');
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [isSending, setIsSending] = useState(false);
  const isDirty = title.trim().length > 0 || message.trim().length > 0;
  const { showDialog, confirmLeave, cancelLeave } = useUnsavedChangesWarning(isDirty);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['broadcast-notifications'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('broadcast_notifications') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as BroadcastNotification[];
    },
  });

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Please fill in the title and message');
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Create the notification record
      const { data: notification, error: insertError } = await (supabase
        .from('broadcast_notifications') as any)
        .insert({
          title: title.trim(),
          message: message.trim(),
          channel,
          recipient_filter: recipientFilter,
          status: 'sending',
          created_by: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call the edge function to actually send
      const { error: fnError } = await supabase.functions.invoke('send-broadcast-notification', {
        body: { notification_id: notification.id },
      });

      if (fnError) {
        // Update status to failed
        await (supabase
          .from('broadcast_notifications') as any)
          .update({ status: 'failed' })
          .eq('id', notification.id);
        throw fnError;
      }

      toast.success('Notification sent successfully!');
      setTitle('');
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['broadcast-notifications'] });
    } catch (error: any) {
      console.error('Send notification error:', error);
      toast.error(error.message || 'Failed to send notification');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
    <div className="space-y-6">
      {/* Compose */}
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-sm">Compose Notification</h3>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Title</Label>
          <Input
            placeholder="e.g. Weekend Special Offer!"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Message</Label>
          <Textarea
            placeholder="Write your notification message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">
                  <span className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </span>
                </SelectItem>
                <SelectItem value="push">
                  <span className="flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5" /> Push Notification
                  </span>
                </SelectItem>
                <SelectItem value="both">
                  <span className="flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" /> Both
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Recipients</Label>
            <Select value={recipientFilter} onValueChange={setRecipientFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active Users (ordered recently)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={sendNotification}
          disabled={isSending || !title.trim() || !message.trim()}
          className="w-full"
          size="lg"
        >
          {isSending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
          ) : (
            <><Send className="w-4 h-4 mr-2" /> Send Notification</>
          )}
        </Button>
      </Card>

      {/* History */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground">Notification History</h3>
        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {!isLoading && notifications.length === 0 && (
          <p className="text-muted-foreground text-sm">No notifications sent yet.</p>
        )}
        {notifications.map((n) => {
          const ChannelIcon = channelIcons[n.channel] || Send;
          const status = statusConfig[n.status] || statusConfig.draft;
          return (
            <Card key={n.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ChannelIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm truncate">{n.title}</span>
                </div>
                <Badge variant={status.variant} className="shrink-0 text-xs">
                  {status.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(n.created_at), 'MMM d, yyyy HH:mm')}
                </span>
                {n.sent_count > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {n.sent_count} sent
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
    <UnsavedChangesDialog open={showDialog} onConfirmLeave={confirmLeave} onCancelLeave={cancelLeave} />
    </>
  );
};
