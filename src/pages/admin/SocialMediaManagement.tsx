import { AdminLayout } from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Share2, Bell } from 'lucide-react';
import { SocialMediaTab } from '@/components/admin/SocialMediaTab';
import { NotificationsTab } from '@/components/admin/NotificationsTab';

const SocialMediaManagement = () => {
  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-bold">Broadcast</h1>

        <Tabs defaultValue="social" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="social" className="flex-1 gap-2">
              <Share2 className="w-4 h-4" />
              Social Media
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1 gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
          </TabsList>
          <TabsContent value="social">
            <SocialMediaTab />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default SocialMediaManagement;
