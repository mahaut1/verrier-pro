import { useState, ComponentType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Box, ShoppingCart, Package, Building2 } from "lucide-react";

import PieceForm from "../forms/piece-form";
import StockForm from "../forms/stock-form";
import GalleryForm from "../forms/gallery-form";
import OrderForm from "../forms/order-form";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

type ActionFormProps = { onSuccess: () => void };
type QuickAction = {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType<ActionFormProps>;
};

export default function QuickActions() {
  const [openDialog, setOpenDialog] = useState<string | null>(null);

  const quickActions: QuickAction[] = [
    { id: "piece",   title: "Créer une pièce",   icon: Box,          component: PieceForm },
    { id: "order",   title: "Nouvelle commande", icon: ShoppingCart, component: OrderForm },
    { id: "stock",   title: "Entrée de stock",   icon: Package,      component: StockForm },
    { id: "gallery", title: "Ajouter galerie",   icon: Building2,    component: GalleryForm },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions rapides</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const FormComponent = action.component;
            return (
              <Dialog
                key={action.id}
                open={openDialog === action.id}
                onOpenChange={(open) => setOpenDialog(open ? action.id : null)}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="relative bg-gray-50 p-6 h-auto border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-100"
                  >
                    <div className="text-center">
                      <action.icon className="mx-auto h-8 w-8 text-gray-400" />
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        {action.title}
                      </span>
                    </div>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <FormComponent onSuccess={() => setOpenDialog(null)} />
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
