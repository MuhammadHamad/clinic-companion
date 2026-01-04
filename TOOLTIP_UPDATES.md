// Simple tooltip updates for the Patients page
// This file contains the minimal changes needed for clean tooltips

// Update the action buttons in the table to have clean tooltips:

/*
Replace this:
<Button variant="ghost" size="icon" onClick={() => openViewDialog(patient)}>
  <Eye className="h-4 w-4" />
</Button>

With this:
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon" onClick={() => openViewDialog(patient)}>
      <Eye className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>View</p>
  </TooltipContent>
</Tooltip>

And similar for Edit, Archive, and Restore buttons.
*/
