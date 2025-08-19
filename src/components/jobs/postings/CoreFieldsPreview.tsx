import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCoreFields } from '@/hooks/useCoreFields'
import { CheckCircle2 } from 'lucide-react'

export function CoreFieldsPreview() {
  const { coreFields } = useCoreFields()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          Core Application Fields
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          These fields are included automatically in all job applications
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {coreFields.map((field) => (
            <div key={field.field_name} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">{field.field_label}</div>
                <div className="text-sm text-muted-foreground">{field.field_name}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={field.field_type === 'file' ? 'secondary' : 'outline'}>
                  {field.field_type}
                </Badge>
                {field.is_required && (
                  <Badge variant="destructive" className="text-xs">
                    Required
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Core fields cannot be modified or removed. They provide essential candidate information and ensure consistent data collection across all applications.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}